import type { ISkill } from "@omni-ai/core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const InputSchema = z.object({
  directory: z.string().describe("Root directory to search in"),
  pattern: z.string().describe("Text substring or regex pattern to search for"),
  extensions: z
    .array(z.string())
    .default([".ts", ".tsx"])
    .describe("File extensions to include in the search"),
  maxResults: z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Maximum number of matching lines to return"),
  useRegex: z
    .boolean()
    .default(false)
    .describe("Treat pattern as a regular expression"),
});

type Input = z.infer<typeof InputSchema>;

interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

async function searchInFile(
  filePath: string,
  matcher: (line: string) => boolean,
  results: SearchMatch[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return;
  const text = await readFile(filePath, "utf-8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (results.length >= maxResults) break;
    if (matcher(lines[i])) {
      results.push({ file: filePath, line: i + 1, content: lines[i].trim() });
    }
  }
}

async function walkAndSearch(
  dir: string,
  extensions: string[],
  matcher: (line: string) => boolean,
  results: SearchMatch[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= maxResults) break;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkAndSearch(fullPath, extensions, matcher, results, maxResults);
    } else if (
      entry.isFile() &&
      extensions.some((ext) => entry.name.endsWith(ext))
    ) {
      await searchInFile(fullPath, matcher, results, maxResults);
    }
  }
}

export const searchCodeSkill: ISkill<Input, SearchMatch[]> = {
  name: "search-code",
  description:
    "Search for a text pattern across TypeScript/TSX source files. Use this to find existing components, hooks, types or patterns before generating new code — avoiding duplicates and understanding existing conventions.",

  async execute(input: Input): Promise<SearchMatch[]> {
    const { directory, pattern, extensions, maxResults, useRegex } =
      InputSchema.parse(input);

    const matcher = useRegex
      ? (line: string) => new RegExp(pattern).test(line)
      : (line: string) => line.includes(pattern);

    const results: SearchMatch[] = [];
    await walkAndSearch(directory, extensions, matcher, results, maxResults);
    return results;
  },
};
