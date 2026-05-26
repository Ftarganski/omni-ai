import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";
import { runGit } from "./shared.js";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Repository root directory"),
  staged: z.boolean().default(false).describe("Show staged (cached) diff instead of working-tree diff"),
  file: z.string().optional().describe("Limit diff to a specific file path"),
  base: z.string().optional().describe("Base ref to diff from (e.g. 'main', 'HEAD~1')"),
});

export type GitDiffInput = z.infer<typeof InputSchema>;

export interface GitDiffOutput {
  diff: string;
  changedFiles: string[];
}

export const gitDiffSkill: ISkill<GitDiffInput, GitDiffOutput> = {
  name: "git-diff",
  description:
    "Return the unified diff of uncommitted changes (or staged changes). Use this to understand what code changed before writing a commit message or performing a code review.",

  async execute(input: GitDiffInput): Promise<GitDiffOutput> {
    const { cwd, staged, file, base } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const diffArgs = ["diff"];
    if (staged) diffArgs.push("--cached");
    if (base) diffArgs.push(base);
    if (file) diffArgs.push("--", file);

    const nameArgs = ["diff", "--name-only"];
    if (staged) nameArgs.push("--cached");
    if (base) nameArgs.push(base);
    if (file) nameArgs.push("--", file);

    const [diff, names] = await Promise.all([runGit(diffArgs, dir), runGit(nameArgs, dir)]);

    const changedFiles = names
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return { diff, changedFiles };
  },
};
