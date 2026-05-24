import type { ISkill } from "@omni-ai/core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

export const writeFileSkill: ISkill<Input, string> = {
  name: "write-file",
  description:
    "Write or overwrite a file with the given content. Use this to create new components, hooks, pages or any source file after generating the code.",

  async execute(input: Input): Promise<string> {
    const { path, content, createDirs } = InputSchema.parse(input);
    if (createDirs) {
      await mkdir(dirname(path), { recursive: true });
    }
    await writeFile(path, content, "utf-8");
    return `Written: ${path}`;
  },
};
