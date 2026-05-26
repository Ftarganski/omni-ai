import { describe, expect, it } from "vitest";
import type { Message, ToolDefinition } from "../../core/src/types.js";
import { fromOpenAIResponse, toOpenAIMessages, toOpenAITools } from "../src/mappers.js";

describe("toOpenAIMessages", () => {
  it("maps all roles including system", () => {
    const messages: Message[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    const result = toOpenAIMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "system", content: "You are helpful" });
  });
});

describe("toOpenAITools", () => {
  it("wraps tools in function format", () => {
    const tools: ToolDefinition[] = [
      {
        name: "write-file",
        description: "Writes a file",
        parameters: { type: "object", properties: {} },
      },
    ];
    const result = toOpenAITools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("function");
    expect(result[0].function.name).toBe("write-file");
    expect(result[0].function.description).toBe("Writes a file");
  });
});

describe("fromOpenAIResponse", () => {
  it("maps text content", () => {
    const response = {
      choices: [{ message: { content: "Hello", role: "assistant", tool_calls: null } }],
      model: "gpt-4o",
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    } as never;
    const result = fromOpenAIResponse(response, "openai");
    expect(result.content).toBe("Hello");
    expect(result.toolCalls).toBeUndefined();
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(5);
  });

  it("maps tool_calls to toolCalls", () => {
    const response = {
      choices: [
        {
          message: {
            content: null,
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                function: { name: "read-file", arguments: '{"path":"src/app.ts"}' },
              },
            ],
          },
        },
      ],
      model: "gpt-4o",
      usage: { prompt_tokens: 15, completion_tokens: 8 },
    } as never;
    const result = fromOpenAIResponse(response, "openai");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]).toEqual({
      id: "call_1",
      name: "read-file",
      arguments: { path: "src/app.ts" },
    });
  });

  it("handles null usage gracefully", () => {
    const response = {
      choices: [{ message: { content: "ok", role: "assistant", tool_calls: null } }],
      model: "gpt-4o",
      usage: null,
    } as never;
    const result = fromOpenAIResponse(response, "openai");
    expect(result.usage).toBeUndefined();
  });
});
