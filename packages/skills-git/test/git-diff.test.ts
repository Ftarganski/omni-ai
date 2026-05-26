import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitDiffSkill } from "../src/git-diff.js";

let repoDir: string;

async function git(args: string[]): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const p = spawn("git", args, { cwd: repoDir, shell: false });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git ${args[0]} failed`))));
    p.on("error", reject);
  });
}

beforeEach(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "omni-git-diff-"));
  await git(["init"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);
  await writeFile(join(repoDir, "index.ts"), "export const a = 1;\n", "utf-8");
  await git(["add", "index.ts"]);
  await git(["commit", "-m", "init"]);
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("gitDiffSkill", () => {
  it("returns diff for unstaged changes", async () => {
    await writeFile(join(repoDir, "index.ts"), "export const a = 2;\n", "utf-8");
    const result = await gitDiffSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.diff).toContain("-export const a = 1;");
    expect(result.diff).toContain("+export const a = 2;");
    expect(result.changedFiles).toContain("index.ts");
  });

  it("returns diff for staged changes", async () => {
    await writeFile(join(repoDir, "index.ts"), "export const a = 99;\n", "utf-8");
    await git(["add", "index.ts"]);
    const result = await gitDiffSkill.execute({ cwd: repoDir, staged: true }, {} as never);
    expect(result.diff).toContain("+export const a = 99;");
    expect(result.changedFiles).toContain("index.ts");
  });

  it("returns empty diff for clean repo", async () => {
    const result = await gitDiffSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.diff).toBe("");
    expect(result.changedFiles).toHaveLength(0);
  });

  it("limits diff to a specific file", async () => {
    await writeFile(join(repoDir, "index.ts"), "export const a = 3;\n", "utf-8");
    await writeFile(join(repoDir, "other.ts"), "export const b = 0;\n", "utf-8");
    const result = await gitDiffSkill.execute({ cwd: repoDir, file: "index.ts" }, {} as never);
    expect(result.changedFiles).toContain("index.ts");
    expect(result.changedFiles).not.toContain("other.ts");
  });
});
