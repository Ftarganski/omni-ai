import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillContext } from "@omni-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gitCommitMessageSkill } from "../../src/git/git-commit-message.js";

let repoDir: string;

async function git(args: string[]): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const p = spawn("git", args, { cwd: repoDir, shell: false });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git ${args[0]} failed`))));
    p.on("error", reject);
  });
}

function mockCtx(response: string): SkillContext {
  return {
    provider: {
      name: "mock",
      capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
      complete: vi.fn().mockResolvedValue({
        content: response,
        model: "mock",
        provider: "mock",
      }),
    },
    config: {},
  };
}

beforeEach(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "omni-git-commit-"));
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

describe("gitCommitMessageSkill", () => {
  it("calls provider with the diff and returns the message", async () => {
    await writeFile(join(repoDir, "index.ts"), "export const a = 2;\n", "utf-8");
    await git(["add", "index.ts"]);
    const ctx = mockCtx("feat(core): update constant value");
    const result = await gitCommitMessageSkill.execute({ cwd: repoDir, staged: true }, ctx);
    expect(result.message).toBe("feat(core): update constant value");
    expect(ctx.provider.complete).toHaveBeenCalledOnce();
  });

  it("returns fallback message when nothing is staged", async () => {
    const ctx = mockCtx("should not be called");
    const result = await gitCommitMessageSkill.execute({ cwd: repoDir, staged: true }, ctx);
    expect(result.message).toBe("chore: no changes staged");
    expect(ctx.provider.complete).not.toHaveBeenCalled();
  });

  it("passes hint to the provider prompt", async () => {
    await writeFile(join(repoDir, "index.ts"), "export const a = 5;\n", "utf-8");
    await git(["add", "index.ts"]);
    const ctx = mockCtx("fix(core): adjust value");
    await gitCommitMessageSkill.execute({ cwd: repoDir, staged: true, hint: "fix" }, ctx);
    const callArg = (ctx.provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.messages[0].content).toContain("fix");
  });
});
