import { describe, expect, it, vi } from "vitest";
import { Agent } from "../src/agents/agent.js";
import type { CompletionRequest, CompletionResponse, IProvider, ISkill } from "../src/types.js";

function makeProvider(responses: Partial<CompletionResponse>[]): IProvider {
  let call = 0;
  const complete = vi.fn();
  complete.mockImplementation(async (req: CompletionRequest) => {
    const resp = responses[call++] ?? { content: "", model: "mock", provider: "mock" };
    if (req.onToken && resp.content) {
      for (const char of resp.content) req.onToken(char);
    }
    return { model: "mock", provider: "mock", ...resp };
  });
  return {
    name: "mock",
    capabilities: { chat: true, embedding: false, streaming: true, toolUse: true, vision: false },
    complete,
  };
}

const echoSkill: ISkill = {
  name: "echo",
  description: "Echoes input",
  execute: async (input: unknown) => `echo:${JSON.stringify(input)}`,
};

describe("Agent", () => {
  it("returns text response when provider returns no tool calls", async () => {
    const provider = makeProvider([{ content: "Hello world", usage: { inputTokens: 10, outputTokens: 5 } }]);
    const agent = new Agent({ name: "test", description: "", systemPrompt: "You are a test agent" }, provider);
    const result = await agent.run({ input: "hi" });
    expect(result.output).toBe("Hello world");
    expect(result.iterations).toBe(1);
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(5);
  });

  it("executes tool calls and continues the loop", async () => {
    const provider = makeProvider([
      {
        content: "calling echo",
        toolCalls: [{ id: "tc1", name: "echo", arguments: { value: "test" } }],
      },
      { content: "Final answer" },
    ]);
    const agent = new Agent({ name: "test", description: "", systemPrompt: "sys" }, provider, [echoSkill]);
    const result = await agent.run({ input: "go" });
    expect(result.output).toBe("Final answer");
    expect(result.iterations).toBe(2);
  });

  it("throws when maxIterations is exceeded", async () => {
    const provider = makeProvider(
      Array(5).fill({
        content: "still going",
        toolCalls: [{ id: "tc1", name: "echo", arguments: {} }],
      })
    );
    const agent = new Agent({ name: "test", description: "", systemPrompt: "sys", maxIterations: 3 }, provider, [
      echoSkill,
    ]);
    await expect(agent.run({ input: "go" })).rejects.toThrow(/maxIterations/);
  });

  it("forwards onToken to provider.complete", async () => {
    const provider = makeProvider([{ content: "streaming output" }]);
    const agent = new Agent({ name: "test", description: "", systemPrompt: "sys" }, provider);
    const chunks: string[] = [];
    await agent.run({ input: "hi", onToken: (chunk) => chunks.push(chunk) });
    expect(chunks.join("")).toBe("streaming output");
  });

  it("returns error string when skill throws", async () => {
    const failSkill: ISkill = {
      name: "fail",
      description: "always fails",
      execute: async () => {
        throw new Error("skill error");
      },
    };
    const provider = makeProvider([
      { content: "", toolCalls: [{ id: "tc1", name: "fail", arguments: {} }] },
      { content: "recovered" },
    ]);
    const agent = new Agent({ name: "test", description: "", systemPrompt: "sys" }, provider, [failSkill]);
    const result = await agent.run({ input: "go" });
    expect(result.output).toBe("recovered");
    // The second complete call should have received the error in messages
    const calls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    const msgsAtSecondCall = calls[1][0].messages as Array<{ role: string; content: string }>;
    const toolResult = msgsAtSecondCall.find((m) => m.content.startsWith("[Tool fail"));
    expect(toolResult?.content).toMatch(/Error: skill error/);
  });
});
