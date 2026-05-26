import { resolve } from "node:path";
import type { ISkill, SkillContext } from "@omni-ai/core";
import { z } from "zod";
import { runGit } from "./shared.js";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Repository root directory"),
  staged: z.boolean().default(true).describe("Use staged diff (true) or full working-tree diff (false)"),
  hint: z.string().optional().describe("Optional free-text hint passed to the LLM, e.g. 'fix', 'feat', 'refactor'"),
});

export type GitCommitMessageInput = z.infer<typeof InputSchema>;

export interface GitCommitMessageOutput {
  message: string;
}

const SYSTEM = `You are an expert software engineer who writes concise, conventional commit messages.
Rules:
- Follow Conventional Commits: <type>(<scope>): <subject>
- Subject line ≤ 72 chars, imperative mood, no trailing period
- If changes span multiple concerns, add a short bullet body after a blank line
- Output ONLY the commit message — no explanation, no markdown fences`;

export const gitCommitMessageSkill: ISkill<GitCommitMessageInput, GitCommitMessageOutput> = {
  name: "git-commit-message",
  description:
    "Generate a conventional commit message for the current staged (or working-tree) changes using the configured LLM provider. Returns a ready-to-use commit message string.",

  async execute(input: GitCommitMessageInput, ctx: SkillContext): Promise<GitCommitMessageOutput> {
    const { cwd, staged, hint } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const diffArgs = ["diff"];
    if (staged) diffArgs.push("--cached");
    const diff = await runGit(diffArgs, dir);

    if (!diff.trim()) {
      return { message: "chore: no changes staged" };
    }

    const promptParts = [
      hint ? `Hint from the developer: ${hint}` : null,
      "--- GIT DIFF ---",
      diff.slice(0, 12_000),
    ]
      .filter(Boolean)
      .join("\n");

    const response = await ctx.provider.complete({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: promptParts }],
      temperature: 0.2,
      maxTokens: 256,
    });

    return { message: response.content.trim() };
  },
};
