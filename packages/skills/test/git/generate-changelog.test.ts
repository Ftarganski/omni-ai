import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateChangelogSkill, groupCommits, renderMarkdown } from "../../src/git/generate-changelog.js";

describe("groupCommits", () => {
  it("groups conventional commits by type in a fixed section order", () => {
    const sections = groupCommits(["fix: crash on empty input", "feat: add export button", "chore: bump deps"]);
    expect(sections.map((s) => s.type)).toEqual(["feat", "fix", "other"]);
    expect(sections.find((s) => s.type === "feat")?.commits).toEqual(["add export button"]);
  });

  it("strips the type/scope prefix from the message", () => {
    const sections = groupCommits(["feat(auth): add login flow"]);
    expect(sections[0].commits).toEqual(["add login flow"]);
  });

  it("puts non-conventional messages under other verbatim", () => {
    const sections = groupCommits(["wip stuff"]);
    expect(sections).toEqual([{ type: "other", commits: ["wip stuff"] }]);
  });
});

describe("renderMarkdown", () => {
  it("renders a section header and bullet list per section", () => {
    const markdown = renderMarkdown([{ type: "feat", commits: ["add export button", "add filters"] }]);
    expect(markdown).toBe("## Features\n\n- add export button\n- add filters");
  });
});

let repoDir: string;

async function git(args: string[]): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolvePromise, reject) => {
    const p = spawn("git", args, { cwd: repoDir, shell: false });
    p.on("close", (code) => (code === 0 ? resolvePromise() : reject(new Error(`git ${args[0]} failed`))));
    p.on("error", reject);
  });
}

beforeEach(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "omni-changelog-test-"));
  await git(["init"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);
  await writeFile(join(repoDir, "README.md"), "# hello", "utf-8");
  await git(["add", "README.md"]);
  await git(["commit", "-m", "chore: initial commit"]);
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("generateChangelogSkill", () => {
  it("derives a changelog from the full history when from is omitted", async () => {
    await writeFile(join(repoDir, "a.ts"), "export const a = 1;", "utf-8");
    await git(["add", "a.ts"]);
    await git(["commit", "-m", "feat: add constant a"]);

    const result = await generateChangelogSkill.execute({ cwd: repoDir }, {} as never);

    expect(result.markdown).toContain("## Features");
    expect(result.markdown).toContain("add constant a");
  });

  it("derives a changelog only for commits after `from`", async () => {
    await git(["tag", "v1.0.0"]);
    await writeFile(join(repoDir, "b.ts"), "export const b = 2;", "utf-8");
    await git(["add", "b.ts"]);
    await git(["commit", "-m", "fix: correct off-by-one"]);

    const result = await generateChangelogSkill.execute({ cwd: repoDir, from: "v1.0.0" }, {} as never);

    expect(result.sections).toEqual([{ type: "fix", commits: ["correct off-by-one"] }]);
  });
});
