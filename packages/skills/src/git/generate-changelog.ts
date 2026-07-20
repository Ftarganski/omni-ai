import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";
import { runGit } from "./shared.js";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Repository root directory"),
  from: z.string().optional().describe("Starting ref/tag (exclusive) — omit to use the full history up to `to`"),
  to: z.string().default("HEAD").describe("Ending ref (inclusive)"),
});

export type GenerateChangelogInput = z.infer<typeof InputSchema>;

export interface ChangelogSection {
  type: string;
  commits: string[];
}

export interface GenerateChangelogOutput {
  markdown: string;
  sections: ChangelogSection[];
}

const SECTION_TITLES: Record<string, string> = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance",
  refactor: "Refactoring",
  docs: "Documentation",
};

const SECTION_ORDER = ["feat", "fix", "perf", "refactor", "docs", "other"];

const CONVENTIONAL_COMMIT_RE = /^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/;

export function groupCommits(subjects: string[]): ChangelogSection[] {
  const byType = new Map<string, string[]>();
  for (const subject of subjects) {
    const match = CONVENTIONAL_COMMIT_RE.exec(subject);
    const type = match && SECTION_TITLES[match[1]] ? match[1] : "other";
    const message = match && type !== "other" ? match[2] : subject;
    const list = byType.get(type) ?? [];
    list.push(message);
    byType.set(type, list);
  }

  return SECTION_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    commits: byType.get(type) as string[],
  }));
}

export function renderMarkdown(sections: ChangelogSection[]): string {
  return sections
    .map((section) => {
      const title = SECTION_TITLES[section.type] ?? "Other";
      const items = section.commits.map((c) => `- ${c}`).join("\n");
      return `## ${title}\n\n${items}`;
    })
    .join("\n\n");
}

export const generateChangelogSkill: ISkill<GenerateChangelogInput, GenerateChangelogOutput> = {
  name: "generate-changelog",
  description:
    "Derive a changelog from git log, grouping Conventional Commits into sections (Features, Bug Fixes, " +
    "Performance, Refactoring, Documentation, Other). Complements git-commit-message in the release flow.",

  async execute(input: GenerateChangelogInput): Promise<GenerateChangelogOutput> {
    const { cwd, from, to } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const range = from ? `${from}..${to}` : to;
    const raw = await runGit(["log", range, "--pretty=format:%s"], dir);
    const subjects = raw.split("\n").filter(Boolean);

    const sections = groupCommits(subjects);
    return { markdown: renderMarkdown(sections), sections };
  },
};
