import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  directory: z.string().describe("Root directory to scan for unreferenced exports"),
  extensions: z.array(z.string()).default([".ts", ".tsx"]).describe("Source file extensions to check"),
  ignorePatterns: z
    .array(z.string())
    .default([".spec.", ".test.", ".d.ts"])
    .describe("Substrings that mark files to skip (specs, declaration files)"),
});

export type FindUnusedExportsInput = z.infer<typeof InputSchema>;

export interface UnusedExport {
  file: string;
  export: string;
}

export interface FindUnusedExportsResult {
  unusedExports: UnusedExport[];
}

interface SourceFile {
  file: string;
  content: string;
}

async function collectFiles(dir: string, exts: string[], ignore: string[]): Promise<SourceFile[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  const files: SourceFile[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, exts, ignore)));
    } else if (
      entry.isFile() &&
      exts.some((e) => entry.name.endsWith(e)) &&
      !ignore.some((p) => entry.name.includes(p))
    ) {
      files.push({ file: fullPath, content: await readFile(fullPath, "utf-8") });
    }
  }
  return files;
}

function extractExports(content: string): string[] {
  const named = [...content.matchAll(/export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g)].map(
    (m) => m[1]
  );
  const defaultMatch = /export\s+default\s+(?:function\s+|class\s+)?(\w+)/.exec(content);
  return defaultMatch ? [...new Set([...named, defaultMatch[1]])] : [...new Set(named)];
}

function countOccurrences(name: string, files: SourceFile[]): number {
  const re = new RegExp(`\\b${name}\\b`, "g");
  return files.reduce((sum, { content }) => sum + (content.match(re)?.length ?? 0), 0);
}

export const findUnusedExportsSkill: ISkill<FindUnusedExportsInput, FindUnusedExportsResult> = {
  name: "find-unused-exports",
  description:
    "Scan a directory/monorepo package for exported symbols never referenced anywhere else in the scanned files. " +
    "Heuristic: counts whole-word occurrences of each exported name across all files — if only the declaration " +
    "itself is found, the export is flagged as unused. Common/generic names may produce false negatives. " +
    "Use this before opening a PR to catch dead exports.",

  async execute(input: FindUnusedExportsInput): Promise<FindUnusedExportsResult> {
    const { directory, extensions, ignorePatterns } = InputSchema.parse(input);
    const files = await collectFiles(directory, extensions, ignorePatterns);

    const unusedExports: UnusedExport[] = [];
    for (const { file, content } of files) {
      for (const exportName of extractExports(content)) {
        if (countOccurrences(exportName, files) <= 1) {
          unusedExports.push({ file, export: exportName });
        }
      }
    }

    return { unusedExports };
  },
};
