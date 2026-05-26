import type { CompletionResponse, Message, ToolCall, ToolDefinition } from "@omni-ai/core";
import type OpenAI from "openai";

export function toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}

export function toOpenAITools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function fromOpenAIResponse(response: OpenAI.ChatCompletion, providerName: string): CompletionResponse {
  const choice = response.choices[0];
  const message = choice.message;
  const toolCalls: ToolCall[] = [];

  for (const tc of message.tool_calls ?? []) {
    toolCalls.push({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
    });
  }

  return {
    content: message.content ?? "",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
    model: response.model,
    provider: providerName,
  };
}
