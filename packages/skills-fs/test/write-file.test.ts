import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSkill } from "../src/write-file.js";

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

describe("writeFileSkill", () => {
  it("writes content to a new file", async () => {
    await writeFileSkill.execute({ path: "output.ts", content: "const x = 1;" }, {} as never);
    const content = await readFile(join(tempDir, "output.ts"), "utf-8");
    expect(content).toBe("const x = 1;");
  });

  it("creates intermediate directories when createDirs is true", async () => {
    await writeFileSkill.execute(
      { path: "src/utils/helper.ts", content: "export {}", createDirs: true },
      {} as never
    );
    const content = await readFile(join(tempDir, "src/utils/helper.ts"), "utf-8");
    expect(content).toBe("export {}");
  });

  it("rejects path traversal", async () => {
    await expect(
      writeFileSkill.execute({ path: "../../evil.ts", content: "bad" }, {} as never)
    ).rejects.toThrow(/Access denied/);
  });

  it("returns a confirmation string", async () => {
    const result = await writeFileSkill.execute(
      { path: "result.ts", content: "ok" },
      {} as never
    );
    expect(result).toMatch(/Written/);
  });
});
