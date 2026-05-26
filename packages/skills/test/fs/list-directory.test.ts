import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDirectorySkill } from "../../src/fs/list-directory.js";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-list-"));
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("listDirectorySkill", () => {
  it("lists files in a flat directory", async () => {
    await writeFile(join(tempDir, "a.ts"), "", "utf-8");
    await writeFile(join(tempDir, "b.ts"), "", "utf-8");
    const result = await listDirectorySkill.execute({ path: "." }, {} as never);
    expect(result).toHaveLength(2);
    expect(result.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(result.some((f) => f.endsWith("b.ts"))).toBe(true);
  });

  it("filters files by extension", async () => {
    await writeFile(join(tempDir, "app.ts"), "", "utf-8");
    await writeFile(join(tempDir, "app.js"), "", "utf-8");
    const result = await listDirectorySkill.execute({ path: ".", extensions: [".ts"] }, {} as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("app.ts");
  });

  it("lists recursively when recursive=true", async () => {
    await mkdir(join(tempDir, "sub"), { recursive: true });
    await writeFile(join(tempDir, "root.ts"), "", "utf-8");
    await writeFile(join(tempDir, "sub", "nested.ts"), "", "utf-8");
    const result = await listDirectorySkill.execute({ path: ".", recursive: true }, {} as never);
    expect(result.some((f) => f.endsWith("root.ts"))).toBe(true);
    expect(result.some((f) => f.endsWith("nested.ts"))).toBe(true);
  });

  it("skips subdirectory contents when recursive=false", async () => {
    await mkdir(join(tempDir, "sub"), { recursive: true });
    await writeFile(join(tempDir, "root.ts"), "", "utf-8");
    await writeFile(join(tempDir, "sub", "nested.ts"), "", "utf-8");
    const result = await listDirectorySkill.execute({ path: ".", recursive: false }, {} as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("root.ts");
  });

  it("rejects paths that escape the working directory", async () => {
    await expect(listDirectorySkill.execute({ path: "../../../etc", recursive: false }, {} as never)).rejects.toThrow(/Access denied/);
  });
});
