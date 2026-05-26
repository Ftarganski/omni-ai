import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";
import { runGit } from "./shared.js";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Repository root directory"),
  maxEntries: z.number().int().positive().default(10).describe("Maximum number of commits to return"),
  branch: z.string().optional().describe("Branch or ref to read log from (defaults to HEAD)"),
  since: z.string().optional().describe("Show commits more recent than this date, e.g. '2 weeks ago'"),
});

export type GitLogInput = z.infer<typeof InputSchema>;

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitLogOutput {
  commits: GitCommit[];
}

const SEP = "\x1f";
const FORMAT = [`%H${SEP}%h${SEP}%an${SEP}%ai${SEP}%s`].join("");

export const gitLogSkill: ISkill<GitLogInput, GitLogOutput> = {
  name: "git-log",
  description:
    "Return recent commit history with hash, author, date and subject. Use this to understand recent changes, find the last stable commit, or generate release notes.",

  async execute(input: GitLogInput): Promise<GitLogOutput> {
    const { cwd, maxEntries, branch, since } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const args = ["log", `--format=${FORMAT}`, `-n`, String(maxEntries)];
    if (since) args.push(`--since=${since}`);
    if (branch) args.push(branch);

    const raw = await runGit(args, dir);
    const commits: GitCommit[] = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, date, ...rest] = line.split(SEP);
        return { hash, shortHash, author, date, message: rest.join(SEP) };
      });

    return { commits };
  },
};
