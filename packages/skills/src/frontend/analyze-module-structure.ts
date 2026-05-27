import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  directory: z.string().describe("Root directory of the React module or feature folder"),
});

export type AnalyzeModuleStructureInput = z.infer<typeof InputSchema>;

export interface ModuleStructure {
  components: string[];
  hooks: string[];
  pages: string[];
  stores: string[];
  indexFiles: string[];
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function categorize(files: string[]): ModuleStructure {
  const result: ModuleStructure = { components: [], hooks: [], pages: [], stores: [], indexFiles: [] };
  for (const f of files) {
    const name = f.split(/[/\\]/).pop() ?? "";
    if (name.includes(".spec.") || name.includes(".test.")) continue;
    if (name === "index.ts" || name === "index.tsx") result.indexFiles.push(f);
    else if (name.startsWith("use")) result.hooks.push(f);
    else if (/page|route/i.test(name)) result.pages.push(f);
    else if (/store|context|provider/i.test(name)) result.stores.push(f);
    else if (/^[A-Z]/.test(name)) result.components.push(f);
  }
  return result;
}

export const analyzeModuleStructureSkill: ISkill<AnalyzeModuleStructureInput, ModuleStructure> = {
  name: "analyze-module-structure",
  description:
    "Map the file structure of a React module directory: lists components, hooks, pages, stores and index files. " +
    "Use this before creating a new feature module to understand the existing layout and avoid duplicating files.",

  async execute(input: AnalyzeModuleStructureInput): Promise<ModuleStructure> {
    const { directory } = InputSchema.parse(input);
    const files = await collectFiles(directory);
    return categorize(files);
  },
};
