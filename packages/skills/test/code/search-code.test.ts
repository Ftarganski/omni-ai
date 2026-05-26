import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { searchCodeSkill } from "../../src/code/search-code.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-code-test-"));
  await mkdir(join(tempDir, "src"));
  await writeFile(
    join(tempDir, "src/orders.ts"),
    ["export class OrdersService {", "  async createOrder() {}", "  async findOrder() {}", "}"].join("\n"),
    "utf-8"
  );
  await writeFile(
    join(tempDir, "src/customers.ts"),
    ["export class CustomersService {", "  async createCustomer() {}", "}"].join("\n"),
    "utf-8"
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("searchCodeSkill", () => {
  it("finds a substring pattern across files", async () => {
    const results = await searchCodeSkill.execute({ directory: tempDir, pattern: "createOrder" }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("createOrder");
  });

  it("finds matches in multiple files", async () => {
    const results = await searchCodeSkill.execute({ directory: tempDir, pattern: "async create" }, {} as never);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("uses regex when useRegex is true", async () => {
    const results = await searchCodeSkill.execute(
      { directory: tempDir, pattern: "find|create", useRegex: true },
      {} as never
    );
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.content).toMatch(/find|create/);
  });

  it("respects maxResults", async () => {
    const results = await searchCodeSkill.execute({ directory: tempDir, pattern: "async", maxResults: 2 }, {} as never);
    expect(results).toHaveLength(2);
  });

  it("returns line numbers", async () => {
    const results = await searchCodeSkill.execute({ directory: tempDir, pattern: "OrdersService" }, {} as never);
    expect(results[0].line).toBeGreaterThan(0);
  });

  it("returns empty array when pattern not found", async () => {
    const results = await searchCodeSkill.execute({ directory: tempDir, pattern: "nonexistent_xyz" }, {} as never);
    expect(results).toHaveLength(0);
  });
});
