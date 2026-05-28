import { describe, expect, it, vi } from "vitest";
import { composeMiddleware } from "../src/middleware/compose.js";
import type { IProvider, ISkill, SkillContext, SkillMiddlewareFn } from "../src/types.js";

const mockProvider: IProvider = {
  name: "mock",
  capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
  complete: vi.fn(),
};

const ctx: SkillContext = { provider: mockProvider, config: {} };

const echoSkill: ISkill = {
  name: "echo",
  description: "Echoes input",
  execute: async (input: unknown) => `echo:${JSON.stringify(input)}`,
};

describe("composeMiddleware", () => {
  it("returns original skill when no middleware given", async () => {
    const wrapped = composeMiddleware([], echoSkill);
    const result = await wrapped.execute({ v: 1 }, ctx);
    expect(result).toBe('echo:{"v":1}');
  });

  it("preserves skill name and description", () => {
    const wrapped = composeMiddleware([], echoSkill);
    expect(wrapped.name).toBe("echo");
    expect(wrapped.description).toBe("Echoes input");
  });

  it("runs a single middleware and passes result through", async () => {
    const log: string[] = [];
    const mw: SkillMiddlewareFn = async (name, _input, _ctx, next) => {
      log.push(`before:${name}`);
      const result = await next();
      log.push(`after:${name}`);
      return result;
    };
    const wrapped = composeMiddleware([mw], echoSkill);
    const result = await wrapped.execute("hi", ctx);
    expect(result).toBe('echo:"hi"');
    expect(log).toEqual(["before:echo", "after:echo"]);
  });

  it("runs middleware in order", async () => {
    const order: string[] = [];
    const mw =
      (label: string): SkillMiddlewareFn =>
      async (_name, _input, _ctx, next) => {
        order.push(`enter:${label}`);
        const result = await next();
        order.push(`exit:${label}`);
        return result;
      };
    const wrapped = composeMiddleware([mw("A"), mw("B")], echoSkill);
    await wrapped.execute(null, ctx);
    expect(order).toEqual(["enter:A", "enter:B", "exit:B", "exit:A"]);
  });

  it("allows middleware to short-circuit and return early", async () => {
    const cache = new Map<string, unknown>();
    const cacheMw: SkillMiddlewareFn = async (name, input, _ctx, next) => {
      const key = `${name}:${JSON.stringify(input)}`;
      if (cache.has(key)) return cache.get(key);
      const result = await next();
      cache.set(key, result);
      return result;
    };
    const callCount = { n: 0 };
    const countedSkill: ISkill = {
      name: "counted",
      description: "",
      execute: async (input: unknown) => {
        callCount.n++;
        return `result:${JSON.stringify(input)}`;
      },
    };
    const wrapped = composeMiddleware([cacheMw], countedSkill);
    await wrapped.execute({ x: 1 }, ctx);
    await wrapped.execute({ x: 1 }, ctx);
    expect(callCount.n).toBe(1);
  });

  it("allows middleware to transform the result", async () => {
    const addSuffixMw: SkillMiddlewareFn = async (_name, _input, _ctx, next) => {
      const result = await next();
      return `${result}:suffixed`;
    };
    const wrapped = composeMiddleware([addSuffixMw], echoSkill);
    const result = await wrapped.execute("test", ctx);
    expect(String(result)).toContain(":suffixed");
  });

  it("propagates errors thrown inside middleware", async () => {
    const errorMw: SkillMiddlewareFn = async () => {
      throw new Error("middleware blocked");
    };
    const wrapped = composeMiddleware([errorMw], echoSkill);
    await expect(wrapped.execute(null, ctx)).rejects.toThrow("middleware blocked");
  });
});
