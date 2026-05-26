import type { IMemoryStore, IProvider, MemoryEntry, MemorySearchResult, SessionId } from "@omni-ai/core";
import { cosineSimilarity } from "../vector.js";
import { InMemoryStore } from "./in-memory.js";

interface CachedEntry {
  content: string;
  vector: number[];
}

/**
 * Wraps any IMemoryStore and replaces keyword search with semantic similarity
 * search powered by an embedding-capable provider.
 *
 * Embeddings are computed on saveMessages and kept in an in-memory cache.
 * The underlying store handles all persistence; the cache is rebuilt from
 * scratch on process restart (embeddings are re-computed lazily on search
 * if the cache is cold).
 */
export class SemanticMemoryStore implements IMemoryStore {
  private provider: IProvider;
  private inner: IMemoryStore;
  private cache = new Map<string, CachedEntry[]>();

  constructor(provider: IProvider, inner?: IMemoryStore) {
    if (!provider.embed) {
      throw new Error(
        `Provider "${provider.name}" does not support embeddings — use a provider with capabilities.embedding = true`
      );
    }
    this.provider = provider;
    this.inner = inner ?? new InMemoryStore();
  }

  async saveMessages(session: SessionId, messages: MemoryEntry[]): Promise<void> {
    await this.inner.saveMessages(session, messages);

    const key = sessionKey(session);
    const cached = this.cache.get(key) ?? [];

    for (const m of messages) {
      try {
        const resp = await this.provider.embed?.({ input: m.content });
        if (resp) cached.push({ content: m.content, vector: resp.embeddings[0] });
      } catch {
        // Embedding failure is non-fatal; fall back to inner store search
      }
    }
    this.cache.set(key, cached);
  }

  async search(session: SessionId, query: string, topK = 5): Promise<MemorySearchResult[]> {
    const key = sessionKey(session);
    const cached = this.cache.get(key);

    if (!cached || cached.length === 0) {
      return this.inner.search ? this.inner.search(session, query, topK) : [];
    }

    try {
      const resp = await this.provider.embed?.({ input: query });
      if (!resp) return this.inner.search?.(session, query, topK) ?? [];
      const queryVector = resp.embeddings[0];
      return cached
        .map((e) => ({ content: e.content, score: cosineSimilarity(queryVector, e.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch {
      return this.inner.search ? this.inner.search(session, query, topK) : [];
    }
  }

  async loadMessages(session: SessionId, limit?: number): Promise<MemoryEntry[]> {
    return this.inner.loadMessages(session, limit);
  }

  async getWorkingMemory(session: SessionId): Promise<string | null> {
    return this.inner.getWorkingMemory?.(session) ?? null;
  }

  async setWorkingMemory(session: SessionId, content: string): Promise<void> {
    return this.inner.setWorkingMemory?.(session, content);
  }

  async close(): Promise<void> {
    return this.inner.close?.();
  }
}

function sessionKey(session: SessionId): string {
  return `${session.resourceId}:${session.threadId}`;
}
