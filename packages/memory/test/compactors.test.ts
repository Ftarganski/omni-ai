import { describe, it, expect, vi } from "vitest";
import { ObservationMaskingCompactor } from "../src/compactors/observation-masking.js";
import { SummaryCompactor } from "../src/compactors/summary.js";
import type { IProvider, Message } from "../../core/src/types.js";

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: i % 2 === 0 && i > 0
      ? `[Tool read-file result]: ${"x".repeat(500)}`
      : `message ${i}`,
  }));
}

describe("ObservationMaskingCompactor", () => {
  it("shouldCompact returns false below threshold", () => {
    const compactor = new ObservationMaskingCompactor(0.7, 4);
    const messages = makeMessages(3);
    expect(compactor.shouldCompact(messages, 100_000)).toBe(false);
  });

  it("masks tool results in older messages but keeps recent ones", async () => {
    const compactor = new ObservationMaskingCompactor(0.7, 2);
    const provider = {} as IProvider;
    const messages: Message[] = [
      { role: "user", content: "[Tool read-file result]: very long content here" },
      { role: "assistant", content: "I read the file" },
      { role: "user", content: "[Tool write-file result]: written ok" }, // recent, should keep
      { role: "assistant", content: "Done" },                            // recent, should keep
    ];
    const result = await compactor.compact(messages, provider);
    expect(result).toHaveLength(4);
    // First message (old tool result) should be masked
    expect(result[0].content).toMatch(/masked/);
    // Recent messages should be untouched
    expect(result[2].content).toBe("[Tool write-file result]: written ok");
    expect(result[3].content).toBe("Done");
  });

  it("does not mask non-tool-result messages", async () => {
    const compactor = new ObservationMaskingCompactor(0.7, 1);
    const provider = {} as IProvider;
    const messages: Message[] = [
      { role: "user", content: "plain user message" },
      { role: "assistant", content: "response" },
    ];
    const result = await compactor.compact(messages, provider);
    expect(result[0].content).toBe("plain user message");
  });
});

describe("SummaryCompactor", () => {
  it("calls provider.complete and returns summary + recent messages", async () => {
    const provider: IProvider = {
      name: "mock",
      capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
      complete: vi.fn().mockResolvedValue({
        content: "Summary: user asked about orders, agent created the module.",
        model: "mock",
        provider: "mock",
      }),
    };
    const compactor = new SummaryCompactor(0.7, 2);
    const messages: Message[] = [
      { role: "user", content: "create orders module" },
      { role: "assistant", content: "creating..." },
      { role: "user", content: "add pagination" },  // recent
      { role: "assistant", content: "done" },        // recent
    ];
    const result = await compactor.compact(messages, provider);
    // First message should be the summary
    expect(result[0].content).toMatch(/Summary/);
    // Last 2 messages should be preserved verbatim
    expect(result[1].content).toBe("add pagination");
    expect(result[2].content).toBe("done");
    expect(provider.complete).toHaveBeenCalledOnce();
  });

  it("returns messages unchanged when count <= lastMessages", async () => {
    const compactor = new SummaryCompactor(0.7, 6);
    const provider = { complete: vi.fn() } as unknown as IProvider;
    const messages = makeMessages(4);
    const result = await compactor.compact(messages, provider);
    expect(result).toEqual(messages);
    expect(provider.complete).not.toHaveBeenCalled();
  });
});
