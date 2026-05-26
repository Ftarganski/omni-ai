import type { IMemoryStore, MemoryEntry, MemorySearchResult, SessionId } from "@omni-ai/core";

function sessionKey(session: SessionId): string {
  return `${session.resourceId}:${session.threadId}`;
}

export class InMemoryStore implements IMemoryStore {
  private messages = new Map<string, MemoryEntry[]>();
  private working = new Map<string, string>();

  async saveMessages(session: SessionId, messages: MemoryEntry[]): Promise<void> {
    const key = sessionKey(session);
    const existing = this.messages.get(key) ?? [];
    this.messages.set(key, [...existing, ...messages]);
  }

  async loadMessages(session: SessionId, limit?: number): Promise<MemoryEntry[]> {
    const entries = this.messages.get(sessionKey(session)) ?? [];
    return limit ? entries.slice(-limit) : entries;
  }

  async search(session: SessionId, query: string, topK = 5): Promise<MemorySearchResult[]> {
    const entries = this.messages.get(sessionKey(session)) ?? [];
    const q = query.toLowerCase();
    return entries
      .filter((e) => e.content.toLowerCase().includes(q))
      .slice(-topK)
      .map((e) => ({ content: e.content, score: 1 }));
  }

  async getWorkingMemory(session: SessionId): Promise<string | null> {
    return this.working.get(sessionKey(session)) ?? null;
  }

  async setWorkingMemory(session: SessionId, content: string): Promise<void> {
    this.working.set(sessionKey(session), content);
  }
}
