import Anthropic from "@anthropic-ai/sdk";
import type {
  IProvider,
  ProviderCapabilities,
  CompletionRequest,
  CompletionResponse,
} from "@omni-ai/core";
import {
  toAnthropicMessages,
  toAnthropicTools,
  extractSystemPrompt,
  fromAnthropicResponse,
} from "./mappers.js";

export class AnthropicProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: false,
    streaming: false,
    toolUse: true,
    vision: true,
  };

  private client: Anthropic;
  private defaultModel: string;

  constructor(options: { apiKey: string; defaultModel?: string; name?: string }) {
    this.name = options.name ?? "anthropic";
    this.defaultModel = options.defaultModel ?? "claude-sonnet-4-6";
    this.client = new Anthropic({ apiKey: options.apiKey });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const system = extractSystemPrompt(request);
    const messages = toAnthropicMessages(request.messages);
    const tools =
      request.tools && request.tools.length > 0
        ? toAnthropicTools(request.tools)
        : undefined;

    const response = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 8096,
      temperature: request.temperature,
      system,
      messages,
      tools,
    });

    return fromAnthropicResponse(response, this.name);
  }
}
