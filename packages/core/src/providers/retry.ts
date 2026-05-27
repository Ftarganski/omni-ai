import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  ProviderCapabilities,
} from "../types.js";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Rate-limit, server errors, and transient network errors
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryProvider implements IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  private inner: IProvider;
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;

  constructor(inner: IProvider, options: RetryOptions = {}) {
    this.inner = inner;
    this.name = inner.name;
    this.capabilities = inner.capabilities;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    return this.withRetry(() => this.inner.complete(request));
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const embedFn = this.inner.embed;
    if (!embedFn) throw new Error(`Provider "${this.name}" does not support embeddings`);
    return this.withRetry(() => embedFn.call(this.inner, request));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries || !isRetryable(err)) throw err;
        // Exponential backoff with jitter
        const base = this.initialDelayMs * 2 ** (attempt - 1);
        const jitter = Math.random() * base * 0.2;
        const wait = Math.min(base + jitter, this.maxDelayMs);
        await delay(wait);
      }
    }
  }
}
