import { describe, expect, it } from "vitest";
import type { CompletionRequest, Message, ToolDefinition } from "../../core/src/types.js";
import { extractSystemPrompt, fromAnthropicResponse, toAnthropicMessages, toAnthropicTools } from "../src/mappers.js";

describe("toAnthropicMessages", () => {
  it("maps user and assistant messages", () => {
    const messages: Message[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    const result = toAnthropicMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "hello" });
    expect(result[1]).toEqual({ role: "assistant", content: "hi" });
  });

  it("filters out system messages", () => {
    const messages: Message[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hello" },
    ];
    const result = toAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });
});

describe("toAnthropicTools", () => {
  it("maps tool definitions to Anthropic format", () => {
    const tools: ToolDefinition[] = [
      {
        name: "read-file",
        description: "Reads a file",
        parameters: { type: "object", properties: { path: { type: "string" } } },
      },
    ];
    const result = toAnthropicTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("read-file");
    expect(result[0].description).toBe("Reads a file");
    expect(result[0].input_schema).toEqual(tools[0].parameters);
  });
});

describe("extractSystemPrompt", () => {
  it("returns systemPrompt field when present", () => {
    const req = { messages: [], systemPrompt: "You are helpful" } as unknown as CompletionRequest;
    expect(extractSystemPrompt(req)).toBe("You are helpful");
  });

  it("extracts system prompt from messages", () => {
    const req = {
      messages: [
        { role: "system", content: "From messages" },
        { role: "user", content: "hi" },
      ],
    } as unknown as CompletionRequest;
    expect(extractSystemPrompt(req)).toBe("From messages");
  });

  it("prefers systemPrompt field over message", () => {
    const req = {
      messages: [{ role: "system", content: "From messages" }],
      systemPrompt: "Override",
    } as unknown as CompletionRequest;
    expect(extractSystemPrompt(req)).toBe("Override");
  });
});

describe("fromAnthropicResponse", () => {
  it("maps text block to content", () => {
    const msg = {
      content: [{ type: "text", text: "Hello" }],
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never;
    const result = fromAnthropicResponse(msg, "anthropic");
    expect(result.content).toBe("Hello");
    expect(result.toolCalls).toBeUndefined();
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(5);
    expect(result.provider).toBe("anthropic");
  });

  it("maps tool_use blocks to toolCalls", () => {
    const msg = {
      content: [{ type: "tool_use", id: "tu1", name: "read-file", input: { path: "src/app.ts" } }],
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 20, output_tokens: 8 },
    } as never;
    const result = fromAnthropicResponse(msg, "anthropic");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: "tu1",
      name: "read-file",
      arguments: { path: "src/app.ts" },
    });
  });

  it("concatenates multiple text blocks", () => {
    const msg = {
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ],
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 5, output_tokens: 5 },
    } as never;
    const result = fromAnthropicResponse(msg, "anthropic");
    expect(result.content).toBe("Hello world");
  });
});
