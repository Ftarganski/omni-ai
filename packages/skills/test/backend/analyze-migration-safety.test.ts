import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeMigrationSafetySkill } from "../../src/backend/analyze-migration-safety.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-migration-safety-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function analyze(sql: string) {
  const path = join(tempDir, "migration.sql");
  await writeFile(path, sql, "utf-8");
  return analyzeMigrationSafetySkill.execute({ path }, {} as never);
}

describe("analyzeMigrationSafetySkill", () => {
  it("flags DROP TABLE as high severity and unsafe", async () => {
    const result = await analyze("DROP TABLE orders;");
    expect(result.safe).toBe(false);
    expect(result.findings[0]).toMatchObject({ rule: "drop-table", severity: "high", line: 1 });
  });

  it("flags DROP COLUMN as high severity", async () => {
    const result = await analyze("ALTER TABLE orders DROP COLUMN legacy_status;");
    expect(result.findings.some((f) => f.rule === "drop-column")).toBe(true);
    expect(result.safe).toBe(false);
  });

  it("flags TRUNCATE as high severity", async () => {
    const result = await analyze("TRUNCATE orders;");
    expect(result.findings.some((f) => f.rule === "truncate")).toBe(true);
  });

  it("flags ALTER COLUMN TYPE as high severity", async () => {
    const result = await analyze("ALTER TABLE orders ALTER COLUMN total TYPE numeric;");
    expect(result.findings.some((f) => f.rule === "alter-column-type")).toBe(true);
  });

  it("flags ADD COLUMN NOT NULL without DEFAULT as medium severity, but not unsafe", async () => {
    const result = await analyze("ALTER TABLE orders ADD COLUMN total INT NOT NULL;");
    expect(result.findings.some((f) => f.rule === "add-column-not-null-no-default")).toBe(true);
    expect(result.safe).toBe(true);
  });

  it("does not flag ADD COLUMN NOT NULL when a DEFAULT is provided", async () => {
    const result = await analyze("ALTER TABLE orders ADD COLUMN total INT NOT NULL DEFAULT 0;");
    expect(result.findings.some((f) => f.rule === "add-column-not-null-no-default")).toBe(false);
  });

  it("flags CREATE INDEX without CONCURRENTLY as medium severity", async () => {
    const result = await analyze("CREATE INDEX idx_orders_status ON orders (status);");
    expect(result.findings.some((f) => f.rule === "create-index-blocking")).toBe(true);
  });

  it("does not flag CREATE INDEX CONCURRENTLY", async () => {
    const result = await analyze("CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);");
    expect(result.findings.some((f) => f.rule === "create-index-blocking")).toBe(false);
  });

  it("flags RENAME COLUMN as medium severity", async () => {
    const result = await analyze("ALTER TABLE orders RENAME COLUMN status TO order_status;");
    expect(result.findings.some((f) => f.rule === "rename-column-or-table")).toBe(true);
  });

  it("returns safe: true and no findings for an additive, safe migration", async () => {
    const result = await analyze("ALTER TABLE orders ADD COLUMN notes TEXT;");
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });
});
