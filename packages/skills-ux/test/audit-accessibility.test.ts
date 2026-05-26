import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditAccessibilitySkill } from "../src/audit-accessibility.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-ux-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("auditAccessibilitySkill", () => {
  it("detects missing alt on img elements", async () => {
    await writeFile(
      join(tempDir, "Component.tsx"),
      `export function Comp() { return <img src="logo.png" />; }`,
      "utf-8"
    );
    const result = await auditAccessibilitySkill.execute(
      { path: tempDir, recursive: false },
      {} as never
    );
    expect(result.issues.some((i) => i.rule.includes("alt"))).toBe(true);
  });

  it("detects onClick on non-interactive element", async () => {
    await writeFile(
      join(tempDir, "Button.tsx"),
      `export function Btn() { return <div onClick={() => {}} />; }`,
      "utf-8"
    );
    const result = await auditAccessibilitySkill.execute(
      { path: tempDir, recursive: false },
      {} as never
    );
    expect(result.issues.some((i) => i.rule.includes("onclick"))).toBe(true);
  });

  it("returns zero critical issues for a clean component", async () => {
    await writeFile(
      join(tempDir, "Clean.tsx"),
      `export function Clean() { return <button type="button">Click me</button>; }`,
      "utf-8"
    );
    const result = await auditAccessibilitySkill.execute(
      { path: tempDir, recursive: false },
      {} as never
    );
    expect(result.issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("returns zero issues when no TSX files exist", async () => {
    const result = await auditAccessibilitySkill.execute(
      { path: tempDir, recursive: false },
      {} as never
    );
    expect(result.issues).toHaveLength(0);
    expect(result.totalFiles).toBe(0);
  });
});
