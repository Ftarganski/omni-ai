import { describe, expect, it, vi } from "vitest";
import { FallbackProvider } from "../../src/providers/fallback.js";
import type { IProvider } from "../../src/types.js";

function makeProvider(name: string, result: "ok" | Error): IProvider {
  return {
    name,
    capabilities: { chat: true, embedding: true, streaming: false, toolUse: false, vision: false },
    complete: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return { content: `from:${name}`, model: "m", provider: name };
    }),
    embed: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return { embeddings: [[0.1]], model: "m", provider: name };
    }),
  } as unknown as IProvider;
}

describe("FallbackProvider", () => {
  it("throws when constructed with empty array", () => {
    expect(() => new FallbackProvider([])).toThrow("at least one provider");
  });

  it("returns primary result on success", async () => {
    const primary = makeProvider("primary", "ok");
    const secondary = makeProvider("secondary", "ok");
    const p = new FallbackProvider([primary, secondary]);

    const result = await p.complete({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("from:primary");
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(secondary.complete).toHaveBeenCalledTimes(0);
  });

  it("falls back to secondary when primary fails", async () => {
    const primary = makeProvider("primary", new Error("primary down"));
    const secondary = makeProvider("secondary", "ok");
    const p = new FallbackProvider([primary, secondary]);

    const result = await p.complete({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("from:secondary");
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(secondary.complete).toHaveBeenCalledTimes(1);
  });

  it("throws aggregate error when all providers fail", async () => {
    const primary = makeProvider("primary", new Error("primary down"));
    const secondary = makeProvider("secondary", new Error("secondary down"));
    const p = new FallbackProvider([primary, secondary]);

    await expect(p.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("All providers failed");
  });

  it("unions capabilities from all providers", () => {
    const a: IProvider = {
      name: "a",
      capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
      complete: vi.fn(),
    };
    const b: IProvider = {
      name: "b",
      capabilities: { chat: false, embedding: true, streaming: false, toolUse: true, vision: false },
      complete: vi.fn(),
    };
    const p = new FallbackProvider([a, b]);
    expect(p.capabilities.chat).toBe(true);
    expect(p.capabilities.embedding).toBe(true);
    expect(p.capabilities.toolUse).toBe(true);
  });

  it("falls back embed across providers", async () => {
    const primary = makeProvider("primary", new Error("primary embed failed"));
    const secondary = makeProvider("secondary", "ok");
    const p = new FallbackProvider([primary, secondary]);

    const result = await p.embed({ input: "hello" });
    expect(result.provider).toBe("secondary");
  });
});
