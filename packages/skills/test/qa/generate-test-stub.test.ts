import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateTestStubSkill } from "../../src/qa/generate-test-stub.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-generate-test-stub-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("generateTestStubSkill", () => {
  it("generates a stub for a service with named exports", async () => {
    const filePath = join(tempDir, "src", "orders.service.ts");
    await writeFile(filePath, "export class OrdersService {\n  findAll() {}\n}\n", "utf-8");
    await writeFile(join(tempDir, "src", "users.service.spec.ts"), "describe('UsersService', () => {})", "utf-8");

    const result = await generateTestStubSkill.execute({ filePath, directory: tempDir }, {} as never);

    expect(result.patternType).toBe("service");
    expect(result.stubPath).toBe(join(tempDir, "src", "orders.service.spec.ts"));
    expect(result.content).toContain('import { OrdersService } from "./orders.service";');
    expect(result.content).toContain('describe("OrdersService"');
    expect(result.exampleFile).toContain("users.service.spec.ts");
  });

  it("generates a stub for a hook with a default export placeholder assertion", async () => {
    const filePath = join(tempDir, "src", "useOrders.ts");
    await writeFile(filePath, "export function useOrders() {}\n", "utf-8");

    const result = await generateTestStubSkill.execute({ filePath, directory: tempDir }, {} as never);

    expect(result.patternType).toBe("hook");
    expect(result.content).toContain("useOrders");
    expect(result.content).toContain("TODO: describe useOrders's behavior");
  });

  it("generates a stub for a component with a default export", async () => {
    const filePath = join(tempDir, "src", "Button.tsx");
    await writeFile(filePath, "export default function Button() {\n  return null;\n}\n", "utf-8");

    const result = await generateTestStubSkill.execute({ filePath, directory: tempDir }, {} as never);

    expect(result.patternType).toBe("component");
    expect(result.stubPath).toBe(join(tempDir, "src", "Button.spec.tsx"));
    expect(result.content).toContain('import Button from "./Button";');
    expect(result.content).toContain('describe("Button"');
  });

  it("respects an explicit patternType override", async () => {
    const filePath = join(tempDir, "src", "orders.resolver.ts");
    await writeFile(filePath, "export class OrdersResolver {}\n", "utf-8");

    const result = await generateTestStubSkill.execute(
      { filePath, directory: tempDir, patternType: "resolver" },
      {} as never
    );

    expect(result.patternType).toBe("resolver");
  });

  it("returns exampleFile null when no matching example test exists", async () => {
    const filePath = join(tempDir, "src", "orders.service.ts");
    await writeFile(filePath, "export class OrdersService {}\n", "utf-8");

    const result = await generateTestStubSkill.execute({ filePath, directory: tempDir }, {} as never);

    expect(result.exampleFile).toBeNull();
  });

  it("throws when patternType cannot be inferred and is not provided", async () => {
    const filePath = join(tempDir, "src", "helpers.ts");
    await writeFile(filePath, "export const noop = () => {};\n", "utf-8");

    await expect(generateTestStubSkill.execute({ filePath, directory: tempDir }, {} as never)).rejects.toThrow(
      /Could not infer/
    );
  });
});
