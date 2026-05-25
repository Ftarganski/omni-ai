import type Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  ToolDefinition,
  ToolCall,
  CompletionRequest,
  CompletionResponse,
} from "@omni-ai/core";

export function toAnthropicMessages(
  messages: Message[]
): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

export function toAnthropicTools(
  tools: ToolDefinition[]
): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }));
}

export function extractSystemPrompt(
  request: CompletionRequest
): string | undefined {
  const systemMsg = request.messages.find((m) => m.role === "system");
  return request.systemPrompt ?? systemMsg?.content;
}

export function fromAnthropicResponse(
  response: Anthropic.Message,
  providerName: string
): CompletionResponse {
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
