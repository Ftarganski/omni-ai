import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeModuleStructureSkill } from "../../src/frontend/analyze-module-structure.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-module-structure-"));
  await mkdir(join(tempDir, "orders"), { recursive: true });
  await writeFile(join(tempDir, "orders", "OrderCard.tsx"), "export function OrderCard() {}", "utf-8");
  await writeFile(join(tempDir, "orders", "OrderList.tsx"), "export function OrderList() {}", "utf-8");
  await writeFile(join(tempDir, "orders", "useOrders.ts"), "export function useOrders() {}", "utf-8");
  await writeFile(join(tempDir, "orders", "OrdersPage.tsx"), "export default function OrdersPage() {}", "utf-8");
  await writeFile(join(tempDir, "orders", "ordersStore.ts"), "export const ordersStore = {};", "utf-8");
  await writeFile(join(tempDir, "orders", "index.ts"), "export * from './OrderCard'", "utf-8");
  await writeFile(join(tempDir, "orders", "OrderCard.spec.tsx"), "describe('OrderCard', () => {})", "utf-8");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeModuleStructureSkill", () => {
  it("finds component files", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.components.some((f) => f.includes("OrderCard.tsx"))).toBe(true);
    expect(result.components.some((f) => f.includes("OrderList.tsx"))).toBe(true);
  });

  it("finds hook files", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.hooks.some((f) => f.includes("useOrders.ts"))).toBe(true);
  });

  it("finds page files", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.pages.some((f) => f.includes("OrdersPage.tsx"))).toBe(true);
  });

  it("finds store files", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.stores.some((f) => f.includes("ordersStore.ts"))).toBe(true);
  });

  it("finds index files", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.indexFiles.some((f) => f.includes("index.ts"))).toBe(true);
  });

  it("excludes spec files from all categories", async () => {
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    const all = [...result.components, ...result.hooks, ...result.pages, ...result.stores, ...result.indexFiles];
    expect(all.every((f) => !f.includes(".spec."))).toBe(true);
  });

  it("returns empty arrays for non-existent directory", async () => {
    const result = await analyzeModuleStructureSkill.execute(
      { directory: join(tempDir, "does-not-exist") },
      {} as never
    );
    expect(result.components).toHaveLength(0);
    expect(result.hooks).toHaveLength(0);
    expect(result.pages).toHaveLength(0);
    expect(result.stores).toHaveLength(0);
    expect(result.indexFiles).toHaveLength(0);
  });

  it("walks nested subdirectories", async () => {
    await mkdir(join(tempDir, "orders", "sub"), { recursive: true });
    await writeFile(join(tempDir, "orders", "sub", "SubWidget.tsx"), "export function SubWidget() {}", "utf-8");
    const result = await analyzeModuleStructureSkill.execute({ directory: tempDir }, {} as never);
    expect(result.components.some((f) => f.includes("SubWidget.tsx"))).toBe(true);
  });
});
