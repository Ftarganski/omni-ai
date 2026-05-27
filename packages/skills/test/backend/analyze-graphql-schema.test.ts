import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeGraphqlSchemaSkill } from "../../src/backend/analyze-graphql-schema.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-graphql-schema-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const sampleSdl = `
extend enum Typenames { Order }

type Order {
  id: ID!
  status: OrderStatus!
}

enum OrderStatus {
  Pending
  Completed
}

input CreateOrderInput {
  total: Float!
}

extend type Query {
  getOrder(id: ID!): Order @assert(can: read, resources: "arn::orders:*")
  listOrders: [Order!]!
}

extend type Mutation {
  createOrder(input: CreateOrderInput!): Order @assert(can: write, resources: "arn::orders:*")
}
`;

describe("analyzeGraphqlSchemaSkill", () => {
  it("extracts type names", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.types).toContain("Order");
  });

  it("excludes Query and Mutation from types", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.types).not.toContain("Query");
    expect(result.types).not.toContain("Mutation");
  });

  it("extracts queries", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.queries.map((q) => q.name)).toContain("getOrder");
    expect(result.queries.map((q) => q.name)).toContain("listOrders");
  });

  it("extracts query directives", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    const getOrder = result.queries.find((q) => q.name === "getOrder");
    expect(getOrder?.directives.some((d) => d.startsWith("@assert"))).toBe(true);
  });

  it("extracts mutations", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.mutations.map((m) => m.name)).toContain("createOrder");
  });

  it("extracts input types", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.inputs).toContain("CreateOrderInput");
  });

  it("extracts enums", async () => {
    const file = join(tempDir, "orders.schema.graphql");
    await writeFile(file, sampleSdl, "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.enums).toContain("OrderStatus");
  });

  it("returns empty arrays for schema with no operations", async () => {
    const file = join(tempDir, "empty.schema.graphql");
    await writeFile(file, "type Foo { id: ID! }", "utf-8");
    const result = await analyzeGraphqlSchemaSkill.execute({ path: file }, {} as never);
    expect(result.queries).toHaveLength(0);
    expect(result.mutations).toHaveLength(0);
  });
});
