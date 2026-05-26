import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";
import { runGit } from "./shared.js";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Repository root directory (defaults to process.cwd())"),
});

export type GitStatusInput = z.infer<typeof InputSchema>;

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface GitStatusOutput {
  branch: string;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
}

function parsePorcelain(raw: string): Omit<GitStatusOutput, "branch"> {
  const staged: GitFileStatus[] = [];
  const unstaged: GitFileStatus[] = [];
  const untracked: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("##")) continue;
    const x = line[0];
    const y = line[1];
    const path = line.slice(3);
    if (x === "?" && y === "?") {
      untracked.push(path);
    } else {
      if (x !== " " && x !== "?") staged.push({ path, status: x });
      if (y !== " " && y !== "?") unstaged.push({ path, status: y });
    }
  }

  return { staged, unstaged, untracked };
}

export const gitStatusSkill: ISkill<GitStatusInput, GitStatusOutput> = {
  name: "git-status",
  description:
    "Return the current git working-tree status: staged changes, unstaged modifications, untracked files and the active branch. Use this before generating a commit message or reviewing pending changes.",

  async execute(input: GitStatusInput): Promise<GitStatusOutput> {
    const { cwd } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const [porcelain, branchRaw] = await Promise.all([
      runGit(["status", "--porcelain", "-b"], dir),
      runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir),
    ]);

    const branch = branchRaw.trim();
    const { staged, unstaged, untracked } = parsePorcelain(porcelain);

    return { branch, staged, unstaged, untracked };
  },
};
