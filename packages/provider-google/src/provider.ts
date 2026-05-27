import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  ProviderCapabilities,
} from "@omni-ai/core";
import { extractSystemInstruction, fromGeminiResponse, toGeminiContents, toGeminiTools } from "./mappers.js";

export class GoogleProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: true,
    streaming: true,
    toolUse: true,
    vision: true,
  };

  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(options: { apiKey: string; defaultModel?: string; name?: string }) {
    this.name = options.name ?? "google";
    this.defaultModel = options.defaultModel ?? "gemini-2.0-flash";
    this.client = new GoogleGenerativeAI(options.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelName = request.model ?? this.defaultModel;
    const systemInstruction = extractSystemInstruction(request);
    const contents = toGeminiContents(request.messages);
    const tools = request.tools && request.tools.length > 0 ? toGeminiTools(request.tools) : undefined;

    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction,
      tools,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    });

    if (request.onToken) {
      const result = await model.generateContentStream({ contents });
      let fullContent = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          request.onToken(text);
        }
      }
      const finalResponse = await result.response;
      const response = fromGeminiResponse(finalResponse, modelName, this.name);
      return { ...response, content: fullContent };
    }

    const result = await model.generateContent({ contents });
    return fromGeminiResponse(result.response, modelName, this.name);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const modelName = "text-embedding-004";
    const model = this.client.getGenerativeModel({ model: modelName });
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    const embeddings = await Promise.all(
      inputs.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      })
    );

    return { embeddings, model: modelName, provider: this.name };
  }
}
