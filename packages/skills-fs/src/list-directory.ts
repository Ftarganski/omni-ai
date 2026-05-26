import { readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Directory path to list"),
  recursive: z.boolean().default(false).describe("Whether to list files in subdirectories recursively"),
  extensions: z.array(z.string()).optional().describe('Filter results by file extension, e.g. [".ts", ".tsx"]'),
});

export type ListDirectoryInput = z.infer<typeof InputSchema>;

function assertSafePath(inputPath: string): string {
  const cwd = process.cwd();
  const resolved = resolve(cwd, inputPath);
  const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (resolved !== cwd && !resolved.startsWith(cwdWithSep)) {
    throw new Error(`Access denied: "${inputPath}" resolves outside the working directory`);
  }
  return resolved;
}

async function walk(dir: string, recursive: boolean, extensions?: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        results.push(...(await walk(fullPath, recursive, extensions)));
      }
    } else if (entry.isFile()) {
      const include = !extensions || extensions.some((ext) => entry.name.endsWith(ext));
      if (include) results.push(fullPath);
    }
  }

  return results;
}

export const listDirectorySkill: ISkill<ListDirectoryInput, string[]> = {
  name: "list-directory",
  description:
    "List files in a directory. Use this to discover existing components, pages or hooks before creating new ones, avoiding duplicates.",

  async execute(input: ListDirectoryInput): Promise<string[]> {
    const { path, recursive, extensions } = InputSchema.parse(input);
    const safePath = assertSafePath(path);
    return await walk(safePath, recursive, extensions);
  },
};
