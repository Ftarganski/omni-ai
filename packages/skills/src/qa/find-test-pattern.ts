import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const patternFilters: Record<string, (name: string) => boolean> = {
  service: (name) => name.endsWith(".service.spec.ts"),
  component: (name) => /^[A-Z]/.test(name) && (name.endsWith(".spec.ts") || name.endsWith(".spec.tsx")),
  hook: (name) => name.startsWith("use") && (name.endsWith(".spec.ts") || name.endsWith(".spec.tsx")),
  resolver: (name) => name.endsWith(".resolver.spec.ts"),
};

const InputSchema = z.object({
  patternType: z
    .enum(["service", "component", "hook", "resolver"])
    .describe("Type of test pattern to find examples of"),
  directory: z.string().describe("Root directory to search in"),
  maxExamples: z.number().int().positive().default(2).describe("Maximum number of test examples to return"),
});

export type FindTestPatternInput = z.infer<typeof InputSchema>;

export interface TestPatternExample {
  file: string;
  content: string;
}

async function walkForTests(
  dir: string,
  filter: (name: string) => boolean,
  results: TestPatternExample[],
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
      await walkForTests(fullPath, filter, results, max);
    } else if (entry.isFile() && filter(entry.name)) {
      const content = await readFile(fullPath, "utf-8");
      results.push({ file: fullPath, content });
    }
  }
}

export const findTestPatternSkill: ISkill<FindTestPatternInput, TestPatternExample[]> = {
  name: "find-test-pattern",
  description:
    "Find real test file examples (service, component, hook, resolver) from the codebase. " +
    "Use this before writing tests to understand the exact test structure, setup() pattern, mocking conventions and assertion style already in use.",

  async execute(input: FindTestPatternInput): Promise<TestPatternExample[]> {
    const { patternType, directory, maxExamples } = InputSchema.parse(input);
    const filter = patternFilters[patternType];
    const results: TestPatternExample[] = [];
    await walkForTests(directory, filter, results, maxExamples);
    return results;
  },
};
