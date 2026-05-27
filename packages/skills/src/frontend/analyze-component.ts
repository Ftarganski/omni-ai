import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to the React component file (.tsx or .ts)"),
});

export type AnalyzeComponentInput = z.infer<typeof InputSchema>;

export interface ComponentAnalysis {
  componentName: string;
  propsInterface: string | null;
  hooksUsed: string[];
  namedExports: string[];
  hasDefaultExport: boolean;
}

function extractComponentName(source: string, filePath: string): string {
  const fnMatch = /(?:export\s+(?:default\s+)?function\s+|const\s+)([A-Z]\w*)/.exec(source);
  if (fnMatch) return fnMatch[1];
  const parts = filePath.split(/[/\\]/);
  return (parts[parts.length - 1] ?? "").replace(/\.(tsx?|jsx?)$/, "");
}

function extractPropsInterface(source: string): string | null {
  const ifaceMatch = /interface\s+(\w*Props\w*)\s*\{([^}]*)\}/.exec(source);
  if (ifaceMatch) return `interface ${ifaceMatch[1]} {${ifaceMatch[2]}}`;
  const typeMatch = /type\s+(\w*Props\w*)\s*=\s*\{([^}]*)\}/.exec(source);
  if (typeMatch) return `type ${typeMatch[1]} = {${typeMatch[2]}}`;
  return null;
}

function extractHooksUsed(source: string): string[] {
  const matches = source.match(/\buse[A-Z]\w*/g) ?? [];
  return [...new Set(matches)];
}

function extractNamedExports(source: string): string[] {
  return [...source.matchAll(/export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g)].map((m) => m[1]);
}

export const analyzeComponentSkill: ISkill<AnalyzeComponentInput, ComponentAnalysis> = {
  name: "analyze-component",
  description:
    "Parse a React component file and extract its name, props interface, hooks used, named exports, and whether it has a default export. " +
    "Use this to understand an existing component's contract before creating a related component or hook.",

  async execute(input: AnalyzeComponentInput): Promise<ComponentAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    return {
      componentName: extractComponentName(source, path),
      propsInterface: extractPropsInterface(source),
      hooksUsed: extractHooksUsed(source),
      namedExports: extractNamedExports(source),
      hasDefaultExport: /export\s+default\s+/.test(source),
    };
  },
};
