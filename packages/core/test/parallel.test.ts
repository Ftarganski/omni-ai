import { describe, expect, it, vi } from "vitest";
import { parallel } from "../src/parallel.js";
import type { AgentRunResult, Runtime } from "../src/index.js";

function makeRuntime(responses: Record<string, AgentRunResult | Error>): Runtime {
  return {
    config: {} as Runtime["config"],
    skills: {} as Runtime["skills"],
    listAgents: vi.fn(),
    run: vi.fn(async (name: string) => {
      const resp = responses[name];
      if (resp instanceof Error) throw resp;
      return resp;
    }),
  } as unknown as Runtime;
}

const result = (output: string, inputTokens = 10, outputTokens = 5): AgentRunResult => ({
  output,
  iterations: 1,
  usage: { inputTokens, outputTokens },
});

describe("parallel", () => {
  it("returns results keyed by agent name", async () => {
    const runtime = makeRuntime({
      "agent-a": result("answer from A"),
      "agent-b": result("answer from B"),
    });
    const res = await parallel(runtime, { agents: ["agent-a", "agent-b"], input: "hello" });
    expect(res.results["agent-a"]).toMatchObject({ output: "answer from A" });
    expect(res.results["agent-b"]).toMatchObject({ output: "answer from B" });
  });

  it("aggregates usage across all agents", async () => {
    const runtime = makeRuntime({
      "agent-a": result("A", 10, 5),
      "agent-b": result("B", 20, 8),
    });
    const res = await parallel(runtime, { agents: ["agent-a", "agent-b"], input: "hello" });
    expect(res.usage.inputTokens).toBe(30);
    expect(res.usage.outputTokens).toBe(13);
  });

  it("captures error without cancelling other agents", async () => {
    const runtime = makeRuntime({
      "agent-ok": result("ok"),
      "agent-fail": new Error("timeout"),
    });
    const res = await parallel(runtime, { agents: ["agent-ok", "agent-fail"], input: "test" });
    expect(res.results["agent-ok"]).toMatchObject({ output: "ok" });
    expect(res.results["agent-fail"]).toMatchObject({ error: "timeout" });
  });

  it("passes usage as 0 when agent provides none", async () => {
    const runtime: Runtime = {
      config: {} as Runtime["config"],
      skills: {} as Runtime["skills"],
      listAgents: vi.fn(),
      run: vi.fn(async () => ({ output: "x", iterations: 1 })),
    } as unknown as Runtime;
    const res = await parallel(runtime, { agents: ["agent-a"], input: "hi" });
    expect(res.usage.inputTokens).toBe(0);
    expect(res.usage.outputTokens).toBe(0);
  });

  it("forwards onToken with agent name", async () => {
    const runtime: Runtime = {
      config: {} as Runtime["config"],
      skills: {} as Runtime["skills"],
      listAgents: vi.fn(),
      run: vi.fn(async (_name: string, _input: string, opts: { onToken?: (c: string) => void }) => {
        opts?.onToken?.("chunk");
        return result("done");
      }),
    } as unknown as Runtime;

    const tokens: Array<{ agent: string; chunk: string }> = [];
    await parallel(runtime, {
      agents: ["agent-a"],
      input: "hi",
      onToken: (agent, chunk) => tokens.push({ agent, chunk }),
    });
    expect(tokens).toEqual([{ agent: "agent-a", chunk: "chunk" }]);
  });

  it("handles an empty agents list", async () => {
    const runtime = makeRuntime({});
    const res = await parallel(runtime, { agents: [], input: "hi" });
    expect(res.results).toEqual({});
    expect(res.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("runs agents concurrently", async () => {
    const startTimes: number[] = [];
    const runtime: Runtime = {
      config: {} as Runtime["config"],
      skills: {} as Runtime["skills"],
      listAgents: vi.fn(),
      run: vi.fn(async () => {
        startTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 20));
        return result("ok");
      }),
    } as unknown as Runtime;

    await parallel(runtime, { agents: ["a", "b", "c"], input: "go" });
    // All three should have started within a very short window (< 10ms apart)
    const spread = Math.max(...startTimes) - Math.min(...startTimes);
    expect(spread).toBeLessThan(50);
  });
});
