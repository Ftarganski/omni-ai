import type { ISkill } from "@omni-ai/core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Absolute or relative path where the file will be written"),
  content: z.string().describe("Full text content to write"),
  createDirs: z
    .boolean()
    .default(true)
    .describe("Create intermediate directories if they do not exist"),
});

type Input = z.infer<typeof InputSchema>;

function assertSafePath(inputPath: string): string {
  const cwd = process.cwd();
  const resolved = resolve(cwd, inputPath);
  const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (resolved !== cwd && !resolved.startsWith(cwdWithSep)) {
    throw new Error(
      `Access denied: "${inputPath}" resolves outside the working directory`
    );
  }
  return resolved;
}

export const writeFileSkill: ISkill<Input, string> = {
  name: "write-file",
  description:
    "Write or overwrite a file with the given content. Use this to create new components, hooks, pages or any source file after generating the code.",

  async execute(input: Input): Promise<string> {
    const { path, content, createDirs } = InputSchema.parse(input);
    const safePath = assertSafePath(path);
    if (createDirs) {
      await mkdir(dirname(safePath), { recursive: true });
    }
    await writeFile(safePath, content, "utf-8");
    return `Written: ${safePath}`;
  },
};
