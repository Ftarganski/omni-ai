import type { IMemoryStore, MemoryEntry, MemorySearchResult, SessionId } from "@omni-ai/core";
import Database from "better-sqlite3";

export interface SQLiteMemoryStoreOptions {
  /** Path to the SQLite database file. Default: "./omni-ai-memory.db" */
  path?: string;
  /** Max messages to return when no limit is specified. Default: 100 */
  defaultLimit?: number;
}

export class SQLiteMemoryStore implements IMemoryStore {
  private db: Database.Database;
  private defaultLimit: number;

  constructor(options: SQLiteMemoryStoreOptions = {}) {
    const path = options.path ?? "./omni-ai-memory.db";
    this.defaultLimit = options.defaultLimit ?? 100;
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id TEXT    NOT NULL,
        thread_id   TEXT    NOT NULL,
        role        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        timestamp   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session
        ON messages (resource_id, thread_id, id);

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        content='messages',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts (rowid, content) VALUES (new.id, new.content);
      END;

      CREATE TABLE IF NOT EXISTS working_memory (
        resource_id TEXT NOT NULL,
        thread_id   TEXT NOT NULL,
        content     TEXT NOT NULL,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (resource_id, thread_id)
      );
    `);
  }

  async saveMessages(session: SessionId, messages: MemoryEntry[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO messages (resource_id, thread_id, role, content, timestamp)
       VALUES (@resourceId, @threadId, @role, @content, @timestamp)`
    );
    const insertMany = this.db.transaction((entries: MemoryEntry[]) => {
      for (const e of entries) {
        insert.run({ ...session, role: e.role, content: e.content, timestamp: e.timestamp });
      }
    });
    insertMany(messages);
  }

  async loadMessages(session: SessionId, limit?: number): Promise<MemoryEntry[]> {
    const n = limit ?? this.defaultLimit;
    const rows = this.db
      .prepare(
        `SELECT role, content, timestamp FROM (
         SELECT role, content, timestamp FROM messages
         WHERE resource_id = ? AND thread_id = ?
         ORDER BY id DESC LIMIT ?
       ) ORDER BY timestamp ASC`
      )
      .all(session.resourceId, session.threadId, n) as MemoryEntry[];
    return rows;
  }

  async search(session: SessionId, query: string, topK = 5): Promise<MemorySearchResult[]> {
    const rows = this.db
      .prepare(
        `SELECT m.content, rank AS score
       FROM messages_fts fts
       JOIN messages m ON m.id = fts.rowid
       WHERE fts.content MATCH ?
         AND m.resource_id = ? AND m.thread_id = ?
       ORDER BY rank LIMIT ?`
      )
      .all(query, session.resourceId, session.threadId, topK) as { content: string; score: number }[];
    return rows.map((r) => ({ content: r.content, score: r.score }));
  }

  async getWorkingMemory(session: SessionId): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT content FROM working_memory WHERE resource_id = ? AND thread_id = ?`)
      .get(session.resourceId, session.threadId) as { content: string } | undefined;
    return row?.content ?? null;
  }

  async setWorkingMemory(session: SessionId, content: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO working_memory (resource_id, thread_id, content, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (resource_id, thread_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
      )
      .run(session.resourceId, session.threadId, content, Date.now());
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
