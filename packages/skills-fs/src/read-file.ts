import type { ISkill } from "@omni-ai/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Absolute or relative path to the file to read"),
});

type Input = z.infer<typeof InputSchema>;

export const readFileSkill: ISkill<Input, string> = {
  name: "read-file",
  description:
    "Read the full text content of a file. Use this to inspect existing components, hooks, pages, config files or any source file before generating new code.",

  async execute(input: Input): Promise<string> {
    const { path } = InputSchema.parse(input);
    return await readFile(path, "utf-8");
  },
};
