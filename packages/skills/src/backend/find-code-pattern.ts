import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const patternSuffixes: Record<string, string[]> = {
  service: [".service.ts"],
  resolver: [".resolver.ts"],
  listener: [".listener.ts"],
  model: [".model.ts"],
  test: [".spec.ts"],
  schema: [".schema.graphql"],
};

const InputSchema = z.object({
  patternType: z
    .enum(["service", "resolver", "listener", "model", "test", "schema"])
    .describe("Type of NestJS pattern to find examples of"),
  directory: z.string().describe("Root directory to search in"),
  maxExamples: z.number().int().positive().default(3).describe("Maximum number of examples to return"),
});

export type FindCodePatternInput = z.infer<typeof InputSchema>;

export interface CodePatternExample {
  file: string;
  content: string;
}

async function walkForPattern(
  dir: string,
  suffixes: string[],
  results: CodePatternExample[],
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
      await walkForPattern(fullPath, suffixes, results, max);
    } else if (entry.isFile() && suffixes.some((s) => entry.name.endsWith(s))) {
      const content = await readFile(fullPath, "utf-8");
      results.push({ file: fullPath, content });
    }
  }
}

export const findCodePatternSkill: ISkill<FindCodePatternInput, CodePatternExample[]> = {
  name: "find-code-pattern",
  description:
    "Find real examples of NestJS patterns (service, resolver, listener, model, test, schema) from the codebase. " +
    "Use this before generating new code to understand the exact conventions and patterns already in use.",

  async execute(input: FindCodePatternInput): Promise<CodePatternExample[]> {
    const { patternType, directory, maxExamples } = InputSchema.parse(input);
    const suffixes = patternSuffixes[patternType];
    const results: CodePatternExample[] = [];
    await walkForPattern(directory, suffixes, results, maxExamples);
    return results;
  },
};
