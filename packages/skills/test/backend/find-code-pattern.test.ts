import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findCodePatternSkill } from "../../src/backend/find-code-pattern.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-find-pattern-"));
  await mkdir(join(tempDir, "src", "features"), { recursive: true });
  await writeFile(join(tempDir, "src", "features", "orders.service.ts"), "export class OrdersService {}", "utf-8");
  await writeFile(join(tempDir, "src", "features", "orders.resolver.ts"), "export class OrdersResolver {}", "utf-8");
  await writeFile(join(tempDir, "src", "features", "orders.model.ts"), "export const OrdersSchema = {};", "utf-8");
  await writeFile(join(tempDir, "src", "features", "orders.spec.ts"), "describe('Orders', () => {})", "utf-8");
  await writeFile(
    join(tempDir, "src", "features", "orders.schema.graphql"),
    "extend type Query { orders: [Order] }",
    "utf-8"
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("findCodePatternSkill", () => {
  it("finds service files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "service", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("orders.service.ts");
    expect(results[0].content).toContain("OrdersService");
  });

  it("finds resolver files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "resolver", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("orders.resolver.ts");
  });

  it("finds model files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "model", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain("orders.model.ts");
  });

  it("finds test files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "test", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain(".spec.ts");
  });

  it("finds graphql schema files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "schema", directory: tempDir }, {} as never);
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain(".schema.graphql");
  });

  it("respects maxExamples", async () => {
    await writeFile(join(tempDir, "src", "features", "users.service.ts"), "export class UsersService {}", "utf-8");
    const results = await findCodePatternSkill.execute(
      { patternType: "service", directory: tempDir, maxExamples: 1 },
      {} as never
    );
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no matching files", async () => {
    const results = await findCodePatternSkill.execute({ patternType: "listener", directory: tempDir }, {} as never);
    expect(results).toHaveLength(0);
  });

  it("handles non-existent directory gracefully", async () => {
    const results = await findCodePatternSkill.execute(
      { patternType: "service", directory: join(tempDir, "does-not-exist") },
      {} as never
    );
    expect(results).toHaveLength(0);
  });
});
