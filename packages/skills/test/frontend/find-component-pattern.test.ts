import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findComponentPatternSkill } from "../../src/frontend/find-component-pattern.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-find-component-"));
  await mkdir(join(tempDir, "src", "components"), { recursive: true });
  await mkdir(join(tempDir, "src", "hooks"), { recursive: true });
  await mkdir(join(tempDir, "src", "pages"), { recursive: true });
  await writeFile(join(tempDir, "src", "components", "Button.tsx"), "export function Button() {}", "utf-8");
  await writeFile(join(tempDir, "src", "components", "Card.tsx"), "export function Card() {}", "utf-8");
  await writeFile(join(tempDir, "src", "hooks", "useOrders.ts"), "export function useOrders() {}", "utf-8");
  await writeFile(join(tempDir, "src", "pages", "OrdersPage.tsx"), "export default function OrdersPage() {}", "utf-8");
  await writeFile(join(tempDir, "src", "components", "index.ts"), "export * from './Button'", "utf-8");
  await writeFile(join(tempDir, "src", "components", "Button.spec.ts"), "describe('Button', () => {})", "utf-8");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("findComponentPatternSkill", () => {
  it("finds component files", async () => {
    const results = await findComponentPatternSkill.execute(
      { patternType: "component", directory: tempDir },
      {} as never
    );
    const files = results.map((r) => r.file);
    expect(files.some((f) => f.includes("Button.tsx"))).toBe(true);
    expect(files.some((f) => f.includes("Card.tsx"))).toBe(true);
  });

  it("excludes spec files from component results", async () => {
    const results = await findComponentPatternSkill.execute(
      { patternType: "component", directory: tempDir },
      {} as never
    );
    expect(results.every((r) => !r.file.includes(".spec."))).toBe(true);
  });

  it("finds hook files", async () => {
    const results = await findComponentPatternSkill.execute({ patternType: "hook", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("useOrders.ts");
    expect(results[0].content).toContain("useOrders");
  });

  it("finds page files", async () => {
    const results = await findComponentPatternSkill.execute({ patternType: "page", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("OrdersPage.tsx");
  });

  it("finds module/index files", async () => {
    const results = await findComponentPatternSkill.execute({ patternType: "module", directory: tempDir }, {} as never);
    expect(results.some((r) => r.file.includes("index.ts"))).toBe(true);
  });

  it("respects maxExamples", async () => {
    const results = await findComponentPatternSkill.execute(
      { patternType: "component", directory: tempDir, maxExamples: 1 },
      {} as never
    );
    expect(results).toHaveLength(1);
  });

  it("returns empty array for non-existent directory", async () => {
    const results = await findComponentPatternSkill.execute(
      { patternType: "component", directory: join(tempDir, "does-not-exist") },
      {} as never
    );
    expect(results).toHaveLength(0);
  });
});
