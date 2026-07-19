import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeApiContractSkill } from "../../src/backend/analyze-api-contract.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-api-contract-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const graphqlSdl = `
type Order {
  id: ID!
  status: OrderStatus!
  total: Float!
}

enum OrderStatus {
  Pending
  Completed
}

extend type Query {
  getOrder(id: ID!): Order
  listOrders: [Order!]!
}

extend type Mutation {
  createOrder(total: Float!): Order
}
`;

describe("analyzeApiContractSkill — GraphQL", () => {
  it("flags an implemented mutation missing from the schema as undocumented", async () => {
    const schemaPath = join(tempDir, "orders.schema.graphql");
    await writeFile(schemaPath, graphqlSdl, "utf-8");
    await writeFile(
      join(tempDir, "src", "orders.resolver.ts"),
      `
      @Resolver()
      class OrdersResolver {
        @Query()
        getOrder() {}

        @Query()
        listOrders() {}

        @Mutation()
        cancelOrder() {}
      }
      `,
      "utf-8"
    );

    const result = await analyzeApiContractSkill.execute({ schemaPath, implementationDir: tempDir }, {} as never);

    expect(result.schemaType).toBe("graphql");
    expect(result.undocumentedRoutes).toContain("Mutation.cancelOrder");
    expect(result.missingImplementations).toContain("Mutation.createOrder");
  });

  it("flags a declared field never referenced in the implementation as orphan", async () => {
    const schemaPath = join(tempDir, "orders.schema.graphql");
    await writeFile(schemaPath, graphqlSdl, "utf-8");
    await writeFile(join(tempDir, "src", "orders.resolver.ts"), "export class OrdersResolver {}\n", "utf-8");
    await writeFile(
      join(tempDir, "src", "orders.model.ts"),
      "export class Order {\n  id: string;\n  status: string;\n}\n",
      "utf-8"
    );

    const result = await analyzeApiContractSkill.execute({ schemaPath, implementationDir: tempDir }, {} as never);

    expect(result.orphanFields).toContain("Order.total");
    expect(result.orphanFields).not.toContain("Order.id");
  });
});

const openApiDoc = {
  paths: {
    "/orders/{id}": {
      get: { operationId: "getOrder" },
    },
    "/orders": {
      post: { operationId: "createOrder" },
    },
  },
  components: {
    schemas: {
      Order: {
        properties: { id: { type: "string" }, total: { type: "number" } },
      },
    },
  },
};

describe("analyzeApiContractSkill — OpenAPI", () => {
  it("flags an implemented route missing from the OpenAPI document as undocumented", async () => {
    const schemaPath = join(tempDir, "openapi.json");
    await writeFile(schemaPath, JSON.stringify(openApiDoc), "utf-8");
    await writeFile(
      join(tempDir, "src", "orders.controller.ts"),
      `
      @Controller('orders')
      class OrdersController {
        @Get(':id')
        getOrder() {}

        @Delete(':id')
        deleteOrder() {}
      }
      `,
      "utf-8"
    );

    const result = await analyzeApiContractSkill.execute({ schemaPath, implementationDir: tempDir }, {} as never);

    expect(result.schemaType).toBe("openapi");
    expect(result.undocumentedRoutes).toContain("DELETE /orders/{id}");
    expect(result.missingImplementations).toContain("POST /orders");
  });

  it("flags a declared schema property never referenced in the implementation as orphan", async () => {
    const schemaPath = join(tempDir, "openapi.json");
    await writeFile(schemaPath, JSON.stringify(openApiDoc), "utf-8");
    await writeFile(join(tempDir, "src", "order.dto.ts"), "export class OrderDto {\n  id: string;\n}\n", "utf-8");

    const result = await analyzeApiContractSkill.execute({ schemaPath, implementationDir: tempDir }, {} as never);

    expect(result.orphanFields).toContain("Order.total");
    expect(result.orphanFields).not.toContain("Order.id");
  });

  it("parses a YAML OpenAPI document", async () => {
    const schemaPath = join(tempDir, "openapi.yaml");
    await writeFile(
      schemaPath,
      `
paths:
  /health:
    get:
      operationId: getHealth
`,
      "utf-8"
    );

    const result = await analyzeApiContractSkill.execute({ schemaPath, implementationDir: tempDir }, {} as never);

    expect(result.declaredOperations).toContain("GET /health");
  });
});
