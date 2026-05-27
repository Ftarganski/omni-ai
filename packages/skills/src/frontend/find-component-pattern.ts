import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const patternFilters: Record<string, (name: string) => boolean> = {
  component: (name) =>
    /^[A-Z]/.test(name) && (name.endsWith(".tsx") || name.endsWith(".ts")) && !name.includes(".spec."),
  hook: (name) => name.startsWith("use") && (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".spec."),
  page: (name) =>
    /page|route/i.test(name) && (name.endsWith(".tsx") || name.endsWith(".ts")) && !name.includes(".spec."),
  module: (name) => (name === "index.ts" || name === "index.tsx" || /module/i.test(name)) && !name.includes(".spec."),
};

const InputSchema = z.object({
  patternType: z.enum(["component", "hook", "page", "module"]).describe("Type of React pattern to find examples of"),
  directory: z.string().describe("Root directory to search in"),
  maxExamples: z.number().int().positive().default(3).describe("Maximum number of examples to return"),
});

export type FindComponentPatternInput = z.infer<typeof InputSchema>;

export interface ComponentPatternExample {
  file: string;
  content: string;
}

async function walkForComponent(
  dir: string,
  filter: (name: string) => boolean,
  results: ComponentPatternExample[],
  max: number
): Promise<void> {
  if (results.length >= max) return;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return;
  for (const entry of entries) {
    if (results.length >= max) break;
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForComponent(fullPath, filter, results, max);
    } else if (entry.isFile() && filter(entry.name)) {
      const content = await readFile(fullPath, "utf-8");
      results.push({ file: fullPath, content });
    }
  }
}

export const findComponentPatternSkill: ISkill<FindComponentPatternInput, ComponentPatternExample[]> = {
  name: "find-component-pattern",
  description:
    "Find real examples of React patterns (component, hook, page, module) from the codebase. " +
    "Use this before generating new UI code to understand the exact naming conventions, file structure and import patterns already in use.",

  async execute(input: FindComponentPatternInput): Promise<ComponentPatternExample[]> {
    const { patternType, directory, maxExamples } = InputSchema.parse(input);
    const filter = patternFilters[patternType];
    const results: ComponentPatternExample[] = [];
    await walkForComponent(directory, filter, results, maxExamples);
    return results;
  },
};
