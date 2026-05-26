import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Absolute or relative path to the file to read"),
});

export type ReadFileInput = z.infer<typeof InputSchema>;

function assertSafePath(inputPath: string): string {
  const cwd = process.cwd();
  const resolved = resolve(cwd, inputPath);
  const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (resolved !== cwd && !resolved.startsWith(cwdWithSep)) {
    throw new Error(`Access denied: "${inputPath}" resolves outside the working directory`);
  }
  return resolved;
}

export const readFileSkill: ISkill<ReadFileInput, string> = {
  name: "read-file",
  description:
    "Read the full text content of a file. Use this to inspect existing components, hooks, pages, config files or any source file before generating new code.",

  async execute(input: ReadFileInput): Promise<string> {
    const { path } = InputSchema.parse(input);
    const safePath = assertSafePath(path);
    return await readFile(safePath, "utf-8");
  },
};
