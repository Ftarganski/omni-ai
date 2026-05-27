import { describe, expect, it, vi } from "vitest";
import { RetryProvider } from "../../src/providers/retry.js";
import type { IProvider } from "../../src/types.js";

function makeProvider(responses: Array<() => Promise<unknown>>): IProvider {
  let call = 0;
  return {
    name: "mock",
    capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
    complete: vi.fn(async () => {
      const fn = responses[call++];
      if (!fn) throw new Error("No more responses");
      return fn() as never;
    }),
  } as unknown as IProvider;
}

const okResponse = { content: "ok", model: "m", provider: "mock" };

describe("RetryProvider", () => {
  it("passes through on first success", async () => {
    const inner = makeProvider([() => Promise.resolve(okResponse)]);
    const p = new RetryProvider(inner);
    const result = await p.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(result.content).toBe("ok");
    expect(inner.complete).toHaveBeenCalledTimes(1);
  });

  it("retries on rate-limit error and succeeds", async () => {
    const inner = makeProvider([
      () => Promise.reject(new Error("429 rate limit exceeded")),
      () => Promise.resolve(okResponse),
    ]);
    const p = new RetryProvider(inner, { maxRetries: 3, initialDelayMs: 1 });

    const result = await p.complete({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("ok");
    expect(inner.complete).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxRetries then throws", async () => {
    const err = new Error("503 service unavailable");
    const inner = makeProvider([
      () => Promise.reject(err),
      () => Promise.reject(err),
      () => Promise.reject(err),
      () => Promise.reject(err),
    ]);
    const p = new RetryProvider(inner, { maxRetries: 3, initialDelayMs: 1 });

    await expect(p.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "503 service unavailable"
    );
    expect(inner.complete).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it("does not retry on non-retryable errors", async () => {
    const inner = makeProvider([() => Promise.reject(new Error("Invalid API key"))]);
    const p = new RetryProvider(inner, { maxRetries: 3 });

    await expect(p.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("Invalid API key");
    expect(inner.complete).toHaveBeenCalledTimes(1);
  });

  it("inherits name and capabilities from inner provider", () => {
    const inner = makeProvider([]);
    inner.name = "my-provider" as never;
    const p = new RetryProvider(inner);
    expect(p.name).toBe("my-provider");
    expect(p.capabilities.chat).toBe(true);
  });
});
