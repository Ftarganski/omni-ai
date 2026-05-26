import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  ProviderCapabilities,
} from "@omni-ai/core";
import OpenAI from "openai";
import { fromOpenAIResponse, toOpenAIMessages, toOpenAITools } from "./mappers.js";

export class OpenAIProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: true,
    streaming: true,
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
    const tools = request.tools && request.tools.length > 0 ? toOpenAITools(request.tools) : undefined;

    if (request.onToken) {
      const stream = await this.client.chat.completions.create({
        model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages,
        tools,
        tool_choice: tools ? "auto" : undefined,
        stream: true,
        stream_options: { include_usage: true },
      });

      let content = "";
      const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {};
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          request.onToken(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { id: "", name: "", args: "" };
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments;
          }
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      const toolCalls = Object.values(toolCallAccum);
      return {
        content,
        toolCalls:
          toolCalls.length > 0
            ? toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.name,
                arguments: (() => {
                  try {
                    return JSON.parse(tc.args) as Record<string, unknown>;
                  } catch {
                    return {};
                  }
                })(),
              }))
            : undefined,
        usage: inputTokens > 0 ? { inputTokens, outputTokens } : undefined,
        model,
        provider: this.name,
      };
    }

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

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? "text-embedding-3-small";
    const input = Array.isArray(request.input) ? request.input : [request.input];
    const response = await this.client.embeddings.create({ model, input });
    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      provider: this.name,
    };
  }
}
