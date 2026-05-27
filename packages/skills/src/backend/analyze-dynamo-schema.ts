import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to the *.model.ts file containing the OneTable schema"),
});

export type AnalyzeDynamoSchemaInput = z.infer<typeof InputSchema>;

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  isEnum: boolean;
}

export interface SchemaEnum {
  name: string;
  values: string[];
}

export interface DynamoSchemaAnalysis {
  schemaName: string;
  entityType: string;
  fields: SchemaField[];
  enums: SchemaEnum[];
  typenames: string[];
}

function extractSchemaName(source: string): string {
  const match = /export\s+const\s+(\w+Schema)\s*=/.exec(source);
  return match?.[1] ?? "UnknownSchema";
}

function extractEntityType(source: string): string {
  const match = /export\s+type\s+(\w+)\s*=\s*Entity</.exec(source);
  return match?.[1] ?? "UnknownEntity";
}

function extractFields(source: string): SchemaField[] {
  const fieldsMatch = /defineSchema\s*\(\s*\{[\s\S]*?fields\s*:\s*\{([\s\S]*?)\}\s*\}\s*\)/.exec(source);
  if (!fieldsMatch) return [];

  const fieldsBlock = fieldsMatch[1];
  const fieldRe = /(\w+)\s*:\s*\{([^}]*)\}/g;
  const fields: SchemaField[] = [];
  let m: RegExpExecArray | null;

  while ((m = fieldRe.exec(fieldsBlock)) !== null) {
    const body = m[2];
    const typeMatch = /type\s*:\s*['"]?(\w+)['"]?/.exec(body);
    const requiredMatch = /required\s*:\s*(true|false)/.exec(body);
    fields.push({
      name: m[1],
      type: typeMatch?.[1] ?? "unknown",
      required: requiredMatch?.[1] === "true",
      isEnum: /enum\s*:\s*\w+/.test(body),
    });
  }
  return fields;
}

function extractEnums(source: string): SchemaEnum[] {
  const enumRe = /export\s+(?:const\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;
  const enums: SchemaEnum[] = [];
  let m: RegExpExecArray | null;

  while ((m = enumRe.exec(source)) !== null) {
    const values = m[2]
      .split(",")
      .map(v => v.trim().split("=")[0].trim())
      .filter(Boolean);
    enums.push({ name: m[1], values });
  }
  return enums;
}

function extractTypenames(source: string): string[] {
  const matches = source.match(/Typenames\.\w+/g) ?? [];
  return [...new Set(matches)];
}

export const analyzeDynamoSchemaSkill: ISkill<AnalyzeDynamoSchemaInput, DynamoSchemaAnalysis> = {
  name: "analyze-dynamo-schema",
  description:
    "Parse a OneTable *.model.ts file and extract the schema name, entity type, fields (with types and required flags), enums, and Typenames references. " +
    "Use this before generating a service to understand the exact entity shape.",

  async execute(input: AnalyzeDynamoSchemaInput): Promise<DynamoSchemaAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    return {
      schemaName: extractSchemaName(source),
      entityType: extractEntityType(source),
      fields: extractFields(source),
      enums: extractEnums(source),
      typenames: extractTypenames(source),
    };
  },
};
