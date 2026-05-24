import type { ISkill, SkillContext } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  // define input fields here
  query: z.string(),
});

type Input = z.infer<typeof InputSchema>;
type Output = string;

export const mySkill: ISkill<Input, Output> = {
  name: "my-skill",
  description: "Describe what this skill does so the AI can decide when to use it",

  async execute(input: Input, _ctx: SkillContext): Promise<Output> {
    const parsed = InputSchema.parse(input);
    // implement skill logic here
    return `Result for: ${parsed.query}`;
  },
};
