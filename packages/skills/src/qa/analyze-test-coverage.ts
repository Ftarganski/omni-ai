import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  directory: z.string().describe("Root directory to scan for source files and their tests"),
  extensions: z.array(z.string()).default([".ts", ".tsx"]).describe("Source file extensions to check"),
  ignorePatterns: z
    .array(z.string())
    .default(["index.ts", "index.tsx", ".spec.", ".test.", ".d.ts", ".module.ts"])
    .describe("Substrings that mark files to skip (index, spec, declaration, module files)"),
});

export type AnalyzeTestCoverageInput = z.infer<typeof InputSchema>;

export interface TestCoverageAnalysis {
  covered: string[];
  uncovered: string[];
  coverageRate: number;
}

async function collectFiles(dir: string, exts: string[], ignore: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, exts, ignore)));
    } else if (
      entry.isFile() &&
      exts.some((e) => entry.name.endsWith(e)) &&
      !ignore.some((p) => entry.name.includes(p) || fullPath.includes(p))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

async function collectAllFiles(dir: string): Promise<Set<string>> {
  const files = await collectFiles(dir, [".ts", ".tsx"], []);
  return new Set(files);
}

function specPathCandidates(filePath: string): string[] {
  const base = filePath.replace(/\.(tsx?)$/, "");
  return [`${base}.spec.ts`, `${base}.spec.tsx`, `${base}.test.ts`, `${base}.test.tsx`];
}

export const analyzeTestCoverageSkill: ISkill<AnalyzeTestCoverageInput, TestCoverageAnalysis> = {
  name: "analyze-test-coverage",
  description:
    "Scan a directory and identify which source files have a corresponding .spec.ts test file and which do not. " +
    "Use this before a QA pass to prioritize which files need tests written.",

  async execute(input: AnalyzeTestCoverageInput): Promise<TestCoverageAnalysis> {
    const { directory, extensions, ignorePatterns } = InputSchema.parse(input);
    const sourceFiles = await collectFiles(directory, extensions, ignorePatterns);
    const allFiles = await collectAllFiles(directory);

    const covered: string[] = [];
    const uncovered: string[] = [];

    for (const file of sourceFiles) {
      const hasSpec = specPathCandidates(file).some((s) => allFiles.has(s));
      if (hasSpec) covered.push(file);
      else uncovered.push(file);
    }

    const total = covered.length + uncovered.length;
    return {
      covered,
      uncovered,
      coverageRate: total === 0 ? 1 : covered.length / total,
    };
  },
};
