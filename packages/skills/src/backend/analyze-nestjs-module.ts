import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to the *.module.ts file"),
});

export type AnalyzeNestjsModuleInput = z.infer<typeof InputSchema>;

export interface NestjsModuleAnalysis {
  moduleName: string;
  imports: string[];
  providers: string[];
  exports: string[];
  controllers: string[];
}

function extractArrayItems(source: string, key: string): string[] {
  const re = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*?)\\]`, "s");
  const match = re.exec(source);
  if (!match) return [];
  return match[1]
    .split(",")
    .map(s => s.trim().replace(/\/\/.*$/m, "").trim())
    .filter(Boolean);
}

function extractModuleName(source: string): string {
  const match = /export\s+class\s+(\w+Module)/.exec(source);
  return match?.[1] ?? "UnknownModule";
}

export const analyzeNestjsModuleSkill: ISkill<AnalyzeNestjsModuleInput, NestjsModuleAnalysis> = {
  name: "analyze-nestjs-module",
  description:
    "Parse a NestJS *.module.ts file and extract its imports, providers, exports and controllers. " +
    "Use this to understand what a module exposes before adding new providers or resolving injection dependencies.",

  async execute(input: AnalyzeNestjsModuleInput): Promise<NestjsModuleAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    return {
      moduleName: extractModuleName(source),
      imports: extractArrayItems(source, "imports"),
      providers: extractArrayItems(source, "providers"),
      exports: extractArrayItems(source, "exports"),
      controllers: extractArrayItems(source, "controllers"),
    };
  },
};
