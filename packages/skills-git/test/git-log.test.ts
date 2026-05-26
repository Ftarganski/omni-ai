import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitLogSkill } from "../src/git-log.js";

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
  repoDir = await mkdtemp(join(tmpdir(), "omni-git-log-"));
  await git(["init"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);

  for (const name of ["a.ts", "b.ts", "c.ts"]) {
    await writeFile(join(repoDir, name), `export const x = 1;\n`, "utf-8");
    await git(["add", name]);
    await git(["commit", "-m", `add ${name}`]);
  }
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("gitLogSkill", () => {
  it("returns commit list", async () => {
    const result = await gitLogSkill.execute({ cwd: repoDir }, {} as never);
    expect(result.commits.length).toBe(3);
  });

  it("respects maxEntries", async () => {
    const result = await gitLogSkill.execute({ cwd: repoDir, maxEntries: 2 }, {} as never);
    expect(result.commits).toHaveLength(2);
  });

  it("each commit has expected fields", async () => {
    const result = await gitLogSkill.execute({ cwd: repoDir, maxEntries: 1 }, {} as never);
    const commit = result.commits[0];
    expect(commit.hash).toHaveLength(40);
    expect(commit.shortHash.length).toBeGreaterThan(0);
    expect(commit.author).toBe("Test");
    expect(commit.message).toContain("add c.ts");
  });

  it("returns empty array for empty log range", async () => {
    const result = await gitLogSkill.execute({ cwd: repoDir, since: "2099-01-01" }, {} as never);
    expect(result.commits).toHaveLength(0);
  });
});
