import OpenAI from "openai";
import type {
  IProvider,
  ProviderCapabilities,
  CompletionRequest,
  CompletionResponse,
} from "@omni-ai/core";
import { toOpenAIMessages, toOpenAITools, fromOpenAIResponse } from "./mappers.js";

export class OpenAIProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: false,
    streaming: false,
    toolUse: true,
    vision: true,
  };

  private client: OpenAI;
  private defaultModel: string;

  constructor(options: {
    apiKey: string;
    defaultModel?: string;
    baseUrl?: string;
    name?: string;
  }) {
    this.name = options.name ?? "openai";
    this.defaultModel = options.defaultModel ?? "gpt-4o";
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const messages = toOpenAIMessages(request.messages);
    const tools =
      request.tools && request.tools.length > 0
        ? toOpenAITools(request.tools)
        : undefined;

    const response = await this.client.chat.completions.create({
      model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
    });

    return fromOpenAIResponse(response, this.name);
  }
}
