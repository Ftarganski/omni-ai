import { describe, expect, it } from "vitest";
import { extractSystemInstruction, fromGeminiResponse, toGeminiContents, toGeminiTools } from "../src/mappers.js";

describe("toGeminiContents", () => {
  it("maps user message to user role", () => {
    const result = toGeminiContents([{ role: "user", content: "Hello" }]);
    expect(result).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
  });

  it("maps assistant message to model role", () => {
    const result = toGeminiContents([{ role: "assistant", content: "Hi there" }]);
    expect(result).toEqual([{ role: "model", parts: [{ text: "Hi there" }] }]);
  });

  it("filters out system messages", () => {
    const result = toGeminiContents([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  it("converts image content parts to inlineData", () => {
    const result = toGeminiContents([
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this" },
          { type: "image", mimeType: "image/png", data: "base64data" },
        ],
      },
    ]);
    expect(result[0].parts).toEqual([
      { text: "Describe this" },
      { inlineData: { mimeType: "image/png", data: "base64data" } },
    ]);
  });
});

describe("extractSystemInstruction", () => {
  it("returns systemPrompt from request", () => {
    const result = extractSystemInstruction({
      messages: [],
      systemPrompt: "You are an expert",
    });
    expect(result).toBe("You are an expert");
  });

  it("returns system message content", () => {
    const result = extractSystemInstruction({
      messages: [{ role: "system", content: "Be concise" }],
    });
    expect(result).toBe("Be concise");
  });

  it("prefers systemPrompt over system message", () => {
    const result = extractSystemInstruction({
      messages: [{ role: "system", content: "From message" }],
      systemPrompt: "From prompt",
    });
    expect(result).toBe("From prompt");
  });

  it("returns undefined when neither is present", () => {
    const result = extractSystemInstruction({ messages: [] });
    expect(result).toBeUndefined();
  });
});

describe("toGeminiTools", () => {
  it("wraps tools as functionDeclarations", () => {
    const result = toGeminiTools([
      { name: "read-file", description: "Reads a file", parameters: { type: "object", properties: {} } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].functionDeclarations).toHaveLength(1);
    expect(result[0].functionDeclarations?.[0].name).toBe("read-file");
    expect(result[0].functionDeclarations?.[0].description).toBe("Reads a file");
  });

  it("maps multiple tools to one functionDeclarations array", () => {
    const result = toGeminiTools([
      { name: "tool-a", description: "A", parameters: {} },
      { name: "tool-b", description: "B", parameters: {} },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].functionDeclarations).toHaveLength(2);
  });
});

describe("fromGeminiResponse", () => {
  it("extracts text content", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    };
    const result = fromGeminiResponse(response, "gemini-2.0-flash", "google");
    expect(result.content).toBe("Hello from Gemini");
    expect(result.model).toBe("gemini-2.0-flash");
    expect(result.provider).toBe("google");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("extracts function call as tool call", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: "read-file", args: { path: "index.ts" } } }],
          },
        },
      ],
      usageMetadata: {},
    };
    const result = fromGeminiResponse(response, "gemini-2.0-flash", "google");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0].name).toBe("read-file");
    expect(result.toolCalls?.[0].id).toBe("read-file");
    expect(result.toolCalls?.[0].arguments).toEqual({ path: "index.ts" });
  });

  it("returns undefined toolCalls when no function calls", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
      usageMetadata: {},
    };
    const result = fromGeminiResponse(response, "gemini-2.0-flash", "google");
    expect(result.toolCalls).toBeUndefined();
  });

  it("handles empty candidates gracefully", () => {
    const response = { candidates: [], usageMetadata: {} };
    const result = fromGeminiResponse(response, "gemini-2.0-flash", "google");
    expect(result.content).toBe("");
    expect(result.toolCalls).toBeUndefined();
  });

  it("returns undefined usage when usageMetadata absent", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    };
    const result = fromGeminiResponse(response, "gemini-2.0-flash", "google");
    expect(result.usage).toBeUndefined();
  });
});
