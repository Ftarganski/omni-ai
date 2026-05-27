import type { Content, FunctionDeclaration, Part, Tool } from "@google/generative-ai";
import type {
  CompletionRequest,
  CompletionResponse,
  ContentPart,
  Message,
  ToolCall,
  ToolDefinition,
} from "@omni-ai/core";

function toGeminiPart(part: ContentPart): Part {
  if (part.type === "text") return { text: part.text };
  return { inlineData: { mimeType: part.mimeType, data: part.data } };
}

function contentToParts(content: string | ContentPart[]): Part[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map(toGeminiPart);
}

export function extractSystemInstruction(request: CompletionRequest): string | undefined {
  const systemMsg = request.messages.find((m) => m.role === "system");
  const raw = request.systemPrompt ?? systemMsg?.content;
  if (raw === undefined) return undefined;
  return typeof raw === "string" ? raw : raw.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function toGeminiContents(messages: Message[]): Content[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: contentToParts(m.content),
    }));
}

export function toGeminiTools(tools: ToolDefinition[]): Tool[] {
  const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as unknown as FunctionDeclaration["parameters"],
  }));
  return [{ functionDeclarations }];
}

export function fromGeminiResponse(
  // biome-ignore lint/suspicious/noExplicitAny: Gemini SDK type varies by version
  response: any,
  modelName: string,
  providerName: string
): CompletionResponse {
  const candidate = response.candidates?.[0];
  const parts: Part[] = candidate?.content?.parts ?? [];

  let content = "";
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if ("text" in part && typeof part.text === "string") {
      content += part.text;
    } else if ("functionCall" in part && part.functionCall) {
      toolCalls.push({
        id: part.functionCall.name,
        name: part.functionCall.name,
        arguments: (part.functionCall.args ?? {}) as Record<string, unknown>,
      });
    }
  }

  const usage = response.usageMetadata
    ? {
        inputTokens: response.usageMetadata.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      }
    : undefined;

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage,
    model: modelName,
    provider: providerName,
  };
}
