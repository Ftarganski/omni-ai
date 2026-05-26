import type { CompletionResponse, ContentPart, Message, ToolCall, ToolDefinition } from "@omni-ai/core";
import type OpenAI from "openai";

function toOpenAIUserContentPart(part: ContentPart): OpenAI.ChatCompletionContentPart {
  if (part.type === "text") return { type: "text", text: part.text };
  return {
    type: "image_url",
    image_url: { url: `data:${part.mimeType};base64,${part.data}` },
  };
}

function contentAsString(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.ChatCompletionMessageParam => {
    if (m.role === "system") {
      // System messages only support plain text in the OpenAI API
      return { role: "system", content: contentAsString(m.content) };
    }
    if (m.role === "assistant") {
      // Assistant turn: images are not valid in assistant content
      return { role: "assistant", content: contentAsString(m.content) };
    }
    // user role supports text + image parts
    return {
      role: "user",
      content: typeof m.content === "string" ? m.content : m.content.map(toOpenAIUserContentPart),
    };
  });
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
