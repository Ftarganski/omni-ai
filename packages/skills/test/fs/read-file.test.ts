import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSkill } from "../../src/fs/read-file.js";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-test-"));
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("readFileSkill", () => {
  it("reads an existing file", async () => {
    await writeFile(join(tempDir, "hello.ts"), "export const x = 1;", "utf-8");
    const content = await readFileSkill.execute({ path: "hello.ts" }, {} as never);
    expect(content).toBe("export const x = 1;");
  });

  it("rejects paths that escape cwd via ..", async () => {
    await expect(readFileSkill.execute({ path: "../../../etc/passwd" }, {} as never)).rejects.toThrow(/Access denied/);
  });

  it("rejects absolute paths outside cwd", async () => {
    await expect(readFileSkill.execute({ path: "/etc/passwd" }, {} as never)).rejects.toThrow(/Access denied/);
  });

  it("throws when file does not exist", async () => {
    await expect(readFileSkill.execute({ path: "nonexistent.ts" }, {} as never)).rejects.toThrow();
  });
});
