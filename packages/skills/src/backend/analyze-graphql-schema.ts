import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to the *.schema.graphql file"),
});

export type AnalyzeGraphqlSchemaInput = z.infer<typeof InputSchema>;

export interface GraphqlOperation {
  name: string;
  args: string;
  returns: string;
  directives: string[];
}

export interface GraphqlSchemaAnalysis {
  types: string[];
  queries: GraphqlOperation[];
  mutations: GraphqlOperation[];
  inputs: string[];
  enums: string[];
}

function extractOperations(source: string, section: "Query" | "Mutation"): GraphqlOperation[] {
  const sectionRe = new RegExp(`extend\\s+type\\s+${section}\\s*\\{([^}]*)\\}`, "s");
  const match = sectionRe.exec(source);
  if (!match) return [];

  const ops: GraphqlOperation[] = [];
  for (const m of match[1].matchAll(/(\w+)\s*(\([^)]*\))?\s*:\s*([^\n@#]+)((?:\s*@\w+[^\n]*)*)/g)) {
    const directives = m[4]
      .trim()
      .split(/\s*@/)
      .filter(Boolean)
      .map((d) => `@${d.trim()}`);
    ops.push({
      name: m[1],
      args: (m[2] ?? "").trim(),
      returns: m[3].trim(),
      directives,
    });
  }
  return ops;
}

function extractTypes(source: string): string[] {
  const types: string[] = [];
  for (const m of source.matchAll(/(?:^|\n)\s*(?:extend\s+)?type\s+(\w+)\s*(?:implements[^{]*)?\{/g)) {
    if (!["Query", "Mutation", "Subscription"].includes(m[1])) types.push(m[1]);
  }
  return [...new Set(types)];
}

function extractInputs(source: string): string[] {
  return [...source.matchAll(/input\s+(\w+)\s*\{/g)].map((m) => m[1]);
}

function extractEnums(source: string): string[] {
  return [...source.matchAll(/(?:extend\s+)?enum\s+(\w+)\s*\{/g)].map((m) => m[1]);
}

export const analyzeGraphqlSchemaSkill: ISkill<AnalyzeGraphqlSchemaInput, GraphqlSchemaAnalysis> = {
  name: "analyze-graphql-schema",
  description:
    "Parse a GraphQL SDL file and extract types, queries, mutations, inputs and enums. " +
    "Use this before generating a resolver to understand what operations already exist and what the correct return types are.",

  async execute(input: AnalyzeGraphqlSchemaInput): Promise<GraphqlSchemaAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    return {
      types: extractTypes(source),
      queries: extractOperations(source, "Query"),
      mutations: extractOperations(source, "Mutation"),
      inputs: extractInputs(source),
      enums: extractEnums(source),
    };
  },
};
