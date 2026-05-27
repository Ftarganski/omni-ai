import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeNestjsModuleSkill } from "../../src/backend/analyze-nestjs-module.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-nestjs-module-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const sampleModule = `
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersResolver } from './orders.resolver';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [OrdersService, OrdersResolver],
  exports: [OrdersService],
  controllers: [],
})
export class OrdersModule {}
`;

describe("analyzeNestjsModuleSkill", () => {
  it("extracts module name", async () => {
    const file = join(tempDir, "orders.module.ts");
    await writeFile(file, sampleModule, "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.moduleName).toBe("OrdersModule");
  });

  it("extracts imports", async () => {
    const file = join(tempDir, "orders.module.ts");
    await writeFile(file, sampleModule, "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.imports).toContain("DatabaseModule");
  });

  it("extracts providers", async () => {
    const file = join(tempDir, "orders.module.ts");
    await writeFile(file, sampleModule, "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.providers).toContain("OrdersService");
    expect(result.providers).toContain("OrdersResolver");
  });

  it("extracts exports", async () => {
    const file = join(tempDir, "orders.module.ts");
    await writeFile(file, sampleModule, "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.exports).toContain("OrdersService");
  });

  it("returns empty arrays for missing sections", async () => {
    const minimal = `@Module({}) export class EmptyModule {}`;
    const file = join(tempDir, "empty.module.ts");
    await writeFile(file, minimal, "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.imports).toHaveLength(0);
    expect(result.providers).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
    expect(result.controllers).toHaveLength(0);
  });

  it("falls back to UnknownModule when no class found", async () => {
    const file = join(tempDir, "no-class.module.ts");
    await writeFile(file, "@Module({}) const x = 1;", "utf-8");
    const result = await analyzeNestjsModuleSkill.execute({ path: file }, {} as never);
    expect(result.moduleName).toBe("UnknownModule");
  });
});
