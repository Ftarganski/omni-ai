import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeTestCoverageSkill } from "../../src/qa/analyze-test-coverage.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-test-coverage-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeTestCoverageSkill", () => {
  it("reports covered files when spec exists", async () => {
    await writeFile(join(tempDir, "src", "orders.service.ts"), "export class OrdersService {}", "utf-8");
    await writeFile(join(tempDir, "src", "orders.service.spec.ts"), "describe('OS', () => {})", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.covered.some((f) => f.includes("orders.service.ts"))).toBe(true);
    expect(result.uncovered.some((f) => f.includes("orders.service.ts"))).toBe(false);
  });

  it("reports uncovered files when spec is missing", async () => {
    await writeFile(join(tempDir, "src", "users.service.ts"), "export class UsersService {}", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.uncovered.some((f) => f.includes("users.service.ts"))).toBe(true);
  });

  it("calculates coverage rate correctly", async () => {
    await writeFile(join(tempDir, "src", "a.ts"), "export const a = 1;", "utf-8");
    await writeFile(join(tempDir, "src", "a.spec.ts"), "describe('a', () => {})", "utf-8");
    await writeFile(join(tempDir, "src", "b.ts"), "export const b = 2;", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.coverageRate).toBe(0.5);
  });

  it("returns coverageRate of 1 when directory is empty", async () => {
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.coverageRate).toBe(1);
    expect(result.covered).toHaveLength(0);
    expect(result.uncovered).toHaveLength(0);
  });

  it("ignores index files by default", async () => {
    await writeFile(join(tempDir, "src", "index.ts"), "export * from './a'", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.covered.concat(result.uncovered).some((f) => f.includes("index.ts"))).toBe(false);
  });

  it("ignores spec files from source list", async () => {
    await writeFile(join(tempDir, "src", "c.spec.ts"), "describe('c', () => {})", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.covered.concat(result.uncovered).some((f) => f.includes(".spec."))).toBe(false);
  });

  it("returns 1 coverage when all files are covered", async () => {
    await writeFile(join(tempDir, "src", "x.ts"), "export const x = 1;", "utf-8");
    await writeFile(join(tempDir, "src", "x.spec.ts"), "describe('x', () => {})", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.coverageRate).toBe(1);
    expect(result.uncovered).toHaveLength(0);
  });

  it("returns 0 coverage when no files are covered", async () => {
    await writeFile(join(tempDir, "src", "y.ts"), "export const y = 1;", "utf-8");
    await writeFile(join(tempDir, "src", "z.ts"), "export const z = 2;", "utf-8");
    const result = await analyzeTestCoverageSkill.execute({ directory: tempDir }, {} as never);
    expect(result.coverageRate).toBe(0);
    expect(result.covered).toHaveLength(0);
  });

  it("handles non-existent directory gracefully", async () => {
    const result = await analyzeTestCoverageSkill.execute({ directory: join(tempDir, "does-not-exist") }, {} as never);
    expect(result.coverageRate).toBe(1);
    expect(result.covered).toHaveLength(0);
    expect(result.uncovered).toHaveLength(0);
  });
});
