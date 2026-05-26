import type Anthropic from "@anthropic-ai/sdk";
import type {
  CompletionRequest,
  CompletionResponse,
  ContentPart,
  Message,
  ToolCall,
  ToolDefinition,
} from "@omni-ai/core";

function toAnthropicContentPart(part: ContentPart): Anthropic.ContentBlockParam {
  if (part.type === "text") return { type: "text", text: part.text };
  return {
    type: "image",
    source: { type: "base64", media_type: part.mimeType, data: part.data },
  };
}

export function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : m.content.map(toAnthropicContentPart),
    }));
}

export function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }));
}

export function extractSystemPrompt(request: CompletionRequest): string | undefined {
  const systemMsg = request.messages.find((m) => m.role === "system");
  const raw = request.systemPrompt ?? systemMsg?.content;
  if (raw === undefined) return undefined;
  return typeof raw === "string" ? raw : raw.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function fromAnthropicResponse(response: Anthropic.Message, providerName: string): CompletionResponse {
  let content = "";
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: response.model,
    provider: providerName,
  };
}
