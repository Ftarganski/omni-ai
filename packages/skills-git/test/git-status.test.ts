import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitStatusSkill } from "../src/git-status.js";

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
  repoDir = await mkdtemp(join(tmpdir(), "omni-git-test-"));
  await git(["init"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);
  await writeFile(join(repoDir, "README.md"), "# hello", "utf-8");
  await git(["add", "README.md"]);
  await git(["commit", "-m", "init"]);
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("gitStatusSkill", () => {
  it("returns branch name", async () => {
    const result = await gitStatusSkill.execute({ cwd: repoDir }, {} as never);
    expect(typeof result.branch).toBe("string");
    expect(result.branch.length).toBeGreaterThan(0);
  });

  it("reports untracked file", async () => {
    await writeFile(join(repoDir, "new.ts"), "export {};", "utf-8");
    const result = await gitStatusSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.untracked).toContain("new.ts");
  });

  it("reports staged file", async () => {
    await writeFile(join(repoDir, "staged.ts"), "export {};", "utf-8");
    await git(["add", "staged.ts"]);
    const result = await gitStatusSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.staged.map((f) => f.path)).toContain("staged.ts");
  });

  it("reports unstaged modification", async () => {
    await writeFile(join(repoDir, "README.md"), "# changed", "utf-8");
    const result = await gitStatusSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.unstaged.map((f) => f.path)).toContain("README.md");
  });

  it("returns empty arrays for clean repo", async () => {
    const result = await gitStatusSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.staged).toHaveLength(0);
    expect(result.unstaged).toHaveLength(0);
    expect(result.untracked).toHaveLength(0);
  });
});
