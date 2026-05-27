import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeDynamoSchemaSkill } from "../../src/backend/analyze-dynamo-schema.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-dynamo-schema-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const sampleModel = `
import { defineSchema, Entity } from '@workspace/toolkit';

export enum OrderStatus {
  Pending = 'Pending',
  Completed = 'Completed',
}

export const OrderSchema = defineSchema({
  fields: {
    id: { type: 'string', required: true },
    status: { type: 'string', required: true, enum: OrderStatus },
    total: { type: 'number', required: false },
  },
});

export type Order = Entity<typeof OrderSchema.fields>;

const typename = Typenames.Orders;
`;

describe("analyzeDynamoSchemaSkill", () => {
  it("extracts schema name", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    expect(result.schemaName).toBe("OrderSchema");
  });

  it("extracts entity type", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    expect(result.entityType).toBe("Order");
  });

  it("extracts fields with types", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    const idField = result.fields.find((f) => f.name === "id");
    expect(idField?.type).toBe("string");
    expect(idField?.required).toBe(true);
  });

  it("detects enum fields", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    const statusField = result.fields.find((f) => f.name === "status");
    expect(statusField?.isEnum).toBe(true);
  });

  it("extracts optional fields", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    const totalField = result.fields.find((f) => f.name === "total");
    expect(totalField?.required).toBe(false);
  });

  it("extracts enums", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    expect(result.enums).toHaveLength(1);
    expect(result.enums[0].name).toBe("OrderStatus");
    expect(result.enums[0].values).toContain("Pending");
    expect(result.enums[0].values).toContain("Completed");
  });

  it("extracts typenames references", async () => {
    const file = join(tempDir, "order.model.ts");
    await writeFile(file, sampleModel, "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    expect(result.typenames).toContain("Typenames.Orders");
  });

  it("returns defaults for minimal file", async () => {
    const file = join(tempDir, "empty.model.ts");
    await writeFile(file, "export const x = 1;", "utf-8");
    const result = await analyzeDynamoSchemaSkill.execute({ path: file }, {} as never);
    expect(result.schemaName).toBe("UnknownSchema");
    expect(result.entityType).toBe("UnknownEntity");
    expect(result.fields).toHaveLength(0);
    expect(result.enums).toHaveLength(0);
  });
});
