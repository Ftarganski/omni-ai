import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findUnusedExportsSkill } from "../../src/code/find-unused-exports.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-unused-exports-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("findUnusedExportsSkill", () => {
  it("does not flag an export referenced from another file", async () => {
    await writeFile(join(tempDir, "src", "orders.ts"), "export function calculateTotal() {}\n", "utf-8");
    await writeFile(
      join(tempDir, "src", "invoice.ts"),
      "import { calculateTotal } from './orders';\ncalculateTotal();\n",
      "utf-8"
    );

    const result = await findUnusedExportsSkill.execute({ directory: tempDir }, {} as never);

    expect(result.unusedExports.some((u) => u.export === "calculateTotal")).toBe(false);
  });

  it("flags an export never referenced elsewhere", async () => {
    await writeFile(join(tempDir, "src", "orders.ts"), "export function neverUsedHelper() {}\n", "utf-8");

    const result = await findUnusedExportsSkill.execute({ directory: tempDir }, {} as never);

    expect(result.unusedExports).toContainEqual({
      file: join(tempDir, "src", "orders.ts"),
      export: "neverUsedHelper",
    });
  });

  it("flags an unused default export", async () => {
    await writeFile(join(tempDir, "src", "Button.tsx"), "export default function Button() {}\n", "utf-8");

    const result = await findUnusedExportsSkill.execute({ directory: tempDir, extensions: [".tsx"] }, {} as never);

    expect(result.unusedExports.some((u) => u.export === "Button")).toBe(true);
  });

  it("ignores spec files when scanning", async () => {
    await writeFile(join(tempDir, "src", "orders.spec.ts"), "export function onlyInSpec() {}\n", "utf-8");

    const result = await findUnusedExportsSkill.execute({ directory: tempDir }, {} as never);

    expect(result.unusedExports).toHaveLength(0);
  });
});
