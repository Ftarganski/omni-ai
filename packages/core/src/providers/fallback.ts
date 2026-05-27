import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  ProviderCapabilities,
} from "../types.js";

export class FallbackProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  private providers: IProvider[];

  constructor(providers: IProvider[]) {
    if (providers.length === 0) throw new Error("FallbackProvider requires at least one provider");
    this.providers = providers;
    this.name = providers.map((p) => p.name).join("|");
    // Capabilities are the union of all providers
    this.capabilities = providers.reduce<ProviderCapabilities>(
      (acc, p) => ({
        chat: acc.chat || p.capabilities.chat,
        embedding: acc.embedding || p.capabilities.embedding,
        streaming: acc.streaming || p.capabilities.streaming,
        toolUse: acc.toolUse || p.capabilities.toolUse,
        vision: acc.vision || p.capabilities.vision,
      }),
      { chat: false, embedding: false, streaming: false, toolUse: false, vision: false }
    );
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const errors: Error[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.complete(request);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    throw new Error(
      `All providers failed:\n${errors.map((e, i) => `  [${this.providers[i].name}] ${e.message}`).join("\n")}`
    );
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const errors: Error[] = [];
    for (const provider of this.providers) {
      if (!provider.embed) continue;
      try {
        return await provider.embed(request);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    if (errors.length === 0) throw new Error(`No provider in "${this.name}" supports embeddings`);
    throw new Error(
      `All providers failed for embed:\n${errors.map((e, i) => `  [${this.providers[i].name}] ${e.message}`).join("\n")}`
    );
  }
}
