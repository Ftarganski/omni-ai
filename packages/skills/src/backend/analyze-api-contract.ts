import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { ISkill, SkillContext } from "@omni-ai/core";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { analyzeGraphqlSchemaSkill } from "./analyze-graphql-schema.js";

const InputSchema = z.object({
  schemaPath: z.string().describe("Path to the declared schema — *.graphql SDL, or an OpenAPI JSON/YAML document"),
  implementationDir: z.string().describe("Root directory of the implementation to compare the schema against"),
  schemaType: z
    .enum(["openapi", "graphql"])
    .optional()
    .describe("Schema kind — auto-detected from schemaPath's extension when omitted"),
});

export type AnalyzeApiContractInput = z.infer<typeof InputSchema>;

export interface ApiContractAnalysis {
  schemaType: "openapi" | "graphql";
  declaredOperations: string[];
  implementedOperations: string[];
  undocumentedRoutes: string[];
  missingImplementations: string[];
  orphanFields: string[];
}

interface SourceFile {
  file: string;
  content: string;
}

async function collectFiles(dir: string, suffix: string): Promise<SourceFile[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  const files: SourceFile[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, suffix)));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push({ file: fullPath, content: await readFile(fullPath, "utf-8") });
    }
  }
  return files;
}

function detectSchemaType(schemaPath: string): "openapi" | "graphql" {
  const ext = extname(schemaPath).toLowerCase();
  return ext === ".graphql" || ext === ".gql" ? "graphql" : "openapi";
}

// --- GraphQL ---

function extractTypeFields(source: string): Map<string, string[]> {
  const fieldsByType = new Map<string, string[]>();
  for (const m of source.matchAll(/(?:extend\s+)?type\s+(\w+)\s*(?:implements[^{]*)?\{([^}]*)\}/gs)) {
    const [, typeName, body] = m;
    if (["Query", "Mutation", "Subscription"].includes(typeName)) continue;
    const fields = [...body.matchAll(/(\w+)\s*(?:\([^)]*\))?\s*:/g)].map((f) => f[1]);
    fieldsByType.set(typeName, [...new Set(fields)]);
  }
  return fieldsByType;
}

function extractGraphqlResolverOperations(files: SourceFile[]): string[] {
  const operations: string[] = [];
  for (const { content } of files) {
    for (const m of content.matchAll(/@(Query|Mutation)\(([^)]*)\)\s*\n?\s*(?:async\s+)?(\w+)\s*\(/g)) {
      const [, decorator, args, methodName] = m;
      const nameMatch = /['"]([^'"]+)['"]/.exec(args);
      operations.push(`${decorator}.${nameMatch?.[1] ?? methodName}`);
    }
  }
  return operations;
}

function isFieldReferenced(field: string, files: SourceFile[]): boolean {
  const re = new RegExp(`\\b${field}\\b`);
  return files.some(({ content }) => re.test(content));
}

async function analyzeGraphqlContract(
  schemaPath: string,
  implementationDir: string,
  ctx: SkillContext
): Promise<ApiContractAnalysis> {
  const source = await readFile(resolve(schemaPath), "utf-8");
  const { queries, mutations } = await analyzeGraphqlSchemaSkill.execute({ path: resolve(schemaPath) }, ctx);
  const declaredOperations = [...queries.map((q) => `Query.${q.name}`), ...mutations.map((m) => `Mutation.${m.name}`)];

  const implFiles = await collectFiles(resolve(implementationDir), ".resolver.ts");
  const implementedOperations = extractGraphqlResolverOperations(implFiles);

  const fieldsByType = extractTypeFields(source);
  const allImplFiles = await collectFiles(resolve(implementationDir), ".ts");
  const orphanFields: string[] = [];
  for (const [typeName, fields] of fieldsByType) {
    for (const field of fields) {
      if (!isFieldReferenced(field, allImplFiles)) orphanFields.push(`${typeName}.${field}`);
    }
  }

  return {
    schemaType: "graphql",
    declaredOperations,
    implementedOperations,
    undocumentedRoutes: implementedOperations.filter((op) => !declaredOperations.includes(op)),
    missingImplementations: declaredOperations.filter((op) => !implementedOperations.includes(op)),
    orphanFields,
  };
}

// --- OpenAPI ---

interface OpenApiDocument {
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

function normalizeRoute(method: string, path: string): string {
  const normalizedPath = `/${path.replace(/^\/+/, "").replace(/:(\w+)/g, "{$1}")}`;
  return `${method.toUpperCase()} ${normalizedPath}`;
}

function parseOpenApiDocument(raw: string, schemaPath: string): OpenApiDocument {
  const ext = extname(schemaPath).toLowerCase();
  return ext === ".yaml" || ext === ".yml" ? (parseYaml(raw) as OpenApiDocument) : (JSON.parse(raw) as OpenApiDocument);
}

function extractDeclaredRoutes(doc: OpenApiDocument): string[] {
  const routes: string[] = [];
  for (const [path, operations] of Object.entries(doc.paths ?? {})) {
    for (const method of Object.keys(operations)) {
      if (HTTP_METHODS.includes(method.toLowerCase())) routes.push(normalizeRoute(method, path));
    }
  }
  return routes;
}

function extractControllerRoutes(files: SourceFile[]): string[] {
  const routes: string[] = [];
  for (const { content } of files) {
    const baseMatch = /@Controller\(\s*['"]?([^'")]*)['"]?\s*\)/.exec(content);
    const base = (baseMatch?.[1] ?? "").replace(/^\/+|\/+$/g, "");
    for (const m of content.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*['"]?([^'")]*)['"]?\s*\)/g)) {
      const [, method, sub] = m;
      const subPath = sub.replace(/^\/+|\/+$/g, "");
      const fullPath = [base, subPath].filter(Boolean).join("/");
      routes.push(normalizeRoute(method, fullPath));
    }
  }
  return routes;
}

async function analyzeOpenApiContract(schemaPath: string, implementationDir: string): Promise<ApiContractAnalysis> {
  const raw = await readFile(resolve(schemaPath), "utf-8");
  const doc = parseOpenApiDocument(raw, schemaPath);

  const declaredOperations = extractDeclaredRoutes(doc);
  const implFiles = await collectFiles(resolve(implementationDir), ".controller.ts");
  const implementedOperations = extractControllerRoutes(implFiles);

  const schemas = doc.components?.schemas ?? doc.definitions ?? {};
  const allImplFiles = await collectFiles(resolve(implementationDir), ".ts");
  const orphanFields: string[] = [];
  for (const [schemaName, schema] of Object.entries(schemas)) {
    for (const field of Object.keys(schema.properties ?? {})) {
      if (!isFieldReferenced(field, allImplFiles)) orphanFields.push(`${schemaName}.${field}`);
    }
  }

  return {
    schemaType: "openapi",
    declaredOperations,
    implementedOperations,
    undocumentedRoutes: implementedOperations.filter((op) => !declaredOperations.includes(op)),
    missingImplementations: declaredOperations.filter((op) => !implementedOperations.includes(op)),
    orphanFields,
  };
}

export const analyzeApiContractSkill: ISkill<AnalyzeApiContractInput, ApiContractAnalysis> = {
  name: "analyze-api-contract",
  description:
    "Compare a declared OpenAPI or GraphQL schema against the implementation code, flagging routes/operations " +
    "implemented but not documented, operations documented but not implemented, and schema fields never " +
    "referenced anywhere in the implementation (orphan fields). Use this before merging a PR that changes an API contract.",

  async execute(input: AnalyzeApiContractInput, ctx: SkillContext): Promise<ApiContractAnalysis> {
    const { schemaPath, implementationDir, schemaType } = InputSchema.parse(input);
    const resolvedType = schemaType ?? detectSchemaType(schemaPath);
    return resolvedType === "graphql"
      ? analyzeGraphqlContract(schemaPath, implementationDir, ctx)
      : analyzeOpenApiContract(schemaPath, implementationDir);
  },
};
