import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findTestPatternSkill } from "../../src/qa/find-test-pattern.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-find-test-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
  await writeFile(join(tempDir, "src", "orders.service.spec.ts"), "describe('OrdersService', () => {})", "utf-8");
  await writeFile(join(tempDir, "src", "orders.resolver.spec.ts"), "describe('OrdersResolver', () => {})", "utf-8");
  await writeFile(join(tempDir, "src", "Button.spec.tsx"), "describe('Button', () => {})", "utf-8");
  await writeFile(join(tempDir, "src", "useOrders.spec.ts"), "describe('useOrders', () => {})", "utf-8");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("findTestPatternSkill", () => {
  it("finds service test files", async () => {
    const results = await findTestPatternSkill.execute({ patternType: "service", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("orders.service.spec.ts");
    expect(results[0].content).toContain("OrdersService");
  });

  it("finds resolver test files", async () => {
    const results = await findTestPatternSkill.execute({ patternType: "resolver", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("orders.resolver.spec.ts");
  });

  it("finds component test files", async () => {
    const results = await findTestPatternSkill.execute({ patternType: "component", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("Button.spec.tsx");
  });

  it("finds hook test files", async () => {
    const results = await findTestPatternSkill.execute({ patternType: "hook", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("useOrders.spec.ts");
  });

  it("respects maxExamples", async () => {
    await writeFile(join(tempDir, "src", "users.service.spec.ts"), "describe('UsersService', () => {})", "utf-8");
    const results = await findTestPatternSkill.execute(
      { patternType: "service", directory: tempDir, maxExamples: 1 },
      {} as never
    );
    expect(results).toHaveLength(1);
  });

  it("returns empty array for non-existent directory", async () => {
    const results = await findTestPatternSkill.execute(
      { patternType: "service", directory: join(tempDir, "does-not-exist") },
      {} as never
    );
    expect(results).toHaveLength(0);
  });

  it("returns empty array when no matching test files", async () => {
    await mkdir(join(tempDir, "only-services"), { recursive: true });
    await writeFile(join(tempDir, "only-services", "foo.service.spec.ts"), "describe('Foo', () => {})", "utf-8");
    const empty = await findTestPatternSkill.execute(
      { patternType: "resolver", directory: join(tempDir, "only-services") },
      {} as never
    );
    expect(empty).toHaveLength(0);
  });
});
