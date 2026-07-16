import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type {
  HistoryCitation,
  HistoryEvent,
  HistoryImportResult,
  HistorySearchHit,
  HistorySession,
  HistorySource,
} from "./types.js";

export interface HistoryStoreOptions {
  /** Path to the SQLite database file. Default: "./omni-ai-history.db" */
  path?: string;
}

interface SourceRow {
  id: string;
  provider: string;
  path: string;
  native_import: number;
  importable: number;
  reason: string | null;
  scope: string;
}

interface SessionRow {
  id: string;
  provider: string;
  source_session_id: string;
  imported_at: number;
  scope: string;
}

interface EventRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  tool_name: string | null;
  ordinal: number;
  ts: number;
}

const sourceFromRow = (r: SourceRow): HistorySource => ({
  id: r.id,
  provider: r.provider,
  path: r.path,
  nativeImport: Boolean(r.native_import),
  importable: Boolean(r.importable),
  reason: r.reason ?? undefined,
  scope: r.scope || undefined,
});

const sessionFromRow = (r: SessionRow): HistorySession => ({
  id: r.id,
  provider: r.provider,
  sourceSessionId: r.source_session_id,
  importedAt: r.imported_at,
  scope: r.scope || undefined,
});

const eventFromRow = (r: EventRow): HistoryEvent => ({
  id: r.id,
  sessionId: r.session_id,
  role: r.role,
  content: r.content,
  toolName: r.tool_name ?? undefined,
  ordinal: r.ordinal,
  timestamp: r.ts,
});

/**
 * Schema for imported third-party agent history: sources → sessions → events, with
 * citations pointing each event back at its original provider file/line.
 *
 * Additive on purpose — this is a separate database from SQLiteMemoryStore. Agent-facing
 * session memory (IMemoryStore) and imported third-party history are different concerns
 * and are never merged into one store.
 */
export class HistoryStore {
  private db: Database.Database;

  constructor(options: HistoryStoreOptions = {}) {
    const path = options.path ?? "./omni-ai-history.db";
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id            TEXT PRIMARY KEY,
        provider      TEXT NOT NULL,
        path          TEXT NOT NULL,
        native_import INTEGER NOT NULL,
        importable    INTEGER NOT NULL,
        reason        TEXT,
        scope         TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id                TEXT PRIMARY KEY,
        provider          TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        imported_at       INTEGER NOT NULL,
        scope             TEXT NOT NULL DEFAULT '',
        UNIQUE (provider, scope, source_session_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_scope ON sessions (scope);

      CREATE TABLE IF NOT EXISTS events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT    NOT NULL REFERENCES sessions (id),
        role       TEXT    NOT NULL,
        content    TEXT    NOT NULL,
        tool_name  TEXT,
        ordinal    INTEGER NOT NULL,
        ts         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_id, ordinal);

      CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        content,
        content='events',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
        INSERT INTO events_fts (rowid, content) VALUES (new.id, new.content);
      END;

      CREATE TABLE IF NOT EXISTS citations (
        event_id    INTEGER NOT NULL REFERENCES events (id),
        source_path TEXT    NOT NULL,
        source_line INTEGER,
        PRIMARY KEY (event_id)
      );
    `);
  }

  upsertSource(source: HistorySource): void {
    this.db
      .prepare(
        `INSERT INTO sources (id, provider, path, native_import, importable, reason, scope)
         VALUES (@id, @provider, @path, @nativeImport, @importable, @reason, @scope)
         ON CONFLICT (id) DO UPDATE SET
           provider = excluded.provider,
           path = excluded.path,
           native_import = excluded.native_import,
           importable = excluded.importable,
           reason = excluded.reason,
           scope = excluded.scope`
      )
      .run({
        id: source.id,
        provider: source.provider,
        path: source.path,
        nativeImport: source.nativeImport ? 1 : 0,
        importable: source.importable ? 1 : 0,
        reason: source.reason ?? null,
        scope: source.scope ?? "",
      });
  }

  listSources(provider?: string): HistorySource[] {
    const rows = provider
      ? (this.db.prepare(`SELECT * FROM sources WHERE provider = ? ORDER BY id`).all(provider) as SourceRow[])
      : (this.db.prepare(`SELECT * FROM sources ORDER BY provider, id`).all() as SourceRow[]);
    return rows.map(sourceFromRow);
  }

  /** Persists one imported session and its events/citations. Idempotent per (provider, scope, sourceSessionId). */
  saveImportResult(provider: string, sessionId: string, result: HistoryImportResult): void {
    const upsertSession = this.db.prepare(
      `INSERT INTO sessions (id, provider, source_session_id, imported_at, scope)
       VALUES (@id, @provider, @sourceSessionId, @importedAt, @scope)
       ON CONFLICT (provider, scope, source_session_id) DO UPDATE SET imported_at = excluded.imported_at`
    );
    const insertEvent = this.db.prepare(
      `INSERT INTO events (session_id, role, content, tool_name, ordinal, ts)
       VALUES (@sessionId, @role, @content, @toolName, @ordinal, @ts)`
    );
    const insertCitation = this.db.prepare(
      `INSERT INTO citations (event_id, source_path, source_line)
       VALUES (@eventId, @sourcePath, @sourceLine)
       ON CONFLICT (event_id) DO UPDATE SET source_path = excluded.source_path, source_line = excluded.source_line`
    );
    // Citations must go first — they reference events(id), and re-importing a session
    // replaces its events entirely, which would otherwise violate the foreign key.
    const deleteCitations = this.db.prepare(
      `DELETE FROM citations WHERE event_id IN (SELECT id FROM events WHERE session_id = ?)`
    );
    const deleteEvents = this.db.prepare(`DELETE FROM events WHERE session_id = ?`);

    const run = this.db.transaction(() => {
      upsertSession.run({
        id: sessionId,
        provider,
        sourceSessionId: result.session.sourceSessionId,
        importedAt: result.session.importedAt,
        scope: result.session.scope ?? "",
      });
      // Re-import replaces prior events for this session.
      deleteCitations.run(sessionId);
      deleteEvents.run(sessionId);

      result.events.forEach((event, i) => {
        const info = insertEvent.run({
          sessionId,
          role: event.role,
          content: event.content,
          toolName: event.toolName ?? null,
          ordinal: event.ordinal,
          ts: event.timestamp,
        });
        const citation = result.citations[i];
        if (citation) {
          insertCitation.run({
            eventId: info.lastInsertRowid,
            sourcePath: citation.sourcePath,
            sourceLine: citation.sourceLine ?? null,
          });
        }
      });
    });
    run();
  }

  getSession(id: string): HistorySession | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
    return row ? sessionFromRow(row) : null;
  }

  listSessions(options: { provider?: string; scope?: string } = {}): HistorySession[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (options.provider) {
      clauses.push("provider = ?");
      params.push(options.provider);
    }
    if (options.scope) {
      clauses.push("scope = ?");
      params.push(options.scope);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM sessions ${where} ORDER BY imported_at DESC`)
      .all(...params) as SessionRow[];
    return rows.map(sessionFromRow);
  }

  listEvents(sessionId: string): HistoryEvent[] {
    const rows = this.db
      .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY ordinal ASC`)
      .all(sessionId) as EventRow[];
    return rows.map(eventFromRow);
  }

  getEvent(id: number): HistoryEvent | null {
    const row = this.db.prepare(`SELECT * FROM events WHERE id = ?`).get(id) as EventRow | undefined;
    return row ? eventFromRow(row) : null;
  }

  /** Events immediately before/after `id` within the same session, `id` included. */
  getEventWindow(id: number, window: number): HistoryEvent[] {
    const center = this.getEvent(id);
    if (!center) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM events
         WHERE session_id = ? AND ordinal BETWEEN ? AND ?
         ORDER BY ordinal ASC`
      )
      .all(center.sessionId, center.ordinal - window, center.ordinal + window) as EventRow[];
    return rows.map(eventFromRow);
  }

  getCitation(eventId: number): HistoryCitation | null {
    const row = this.db.prepare(`SELECT * FROM citations WHERE event_id = ?`).get(eventId) as
      | { event_id: number; source_path: string; source_line: number | null }
      | undefined;
    return row
      ? { eventId: row.event_id, sourcePath: row.source_path, sourceLine: row.source_line ?? undefined }
      : null;
  }

  /**
   * Full-text search over event content. Session-diverse by default: at most `groupLimit`
   * hits per session so one large session can't crowd out the rest of the result page.
   *
   * Scoped by default in spirit — callers (CLI, MCP skills) are expected to pass `scope`
   * for project-aware providers so an agent working in one project never sees another
   * project's imported history. Omitting `scope` searches across every scope.
   */
  search(
    query: string,
    options: { sessionId?: string; scope?: string; limit?: number; groupLimit?: number } = {}
  ): HistorySearchHit[] {
    const limit = options.limit ?? 20;
    const groupLimit = options.groupLimit ?? 3;

    const clauses = ["fts.content MATCH @query"];
    const params: Record<string, string> = { query };
    if (options.sessionId) {
      clauses.push("e.session_id = @sessionId");
      params.sessionId = options.sessionId;
    }
    if (options.scope) {
      clauses.push("s.scope = @scope");
      params.scope = options.scope;
    }

    const rows = this.db
      .prepare(
        `SELECT e.*, rank AS score FROM events_fts fts
         JOIN events e ON e.id = fts.rowid
         JOIN sessions s ON s.id = e.session_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY rank`
      )
      .all(params) as (EventRow & { score: number })[];

    const perSession = new Map<string, number>();
    const sessionCache = new Map<string, HistorySession | null>();
    const hits: HistorySearchHit[] = [];

    for (const row of rows) {
      if (hits.length >= limit) break;
      const count = perSession.get(row.session_id) ?? 0;
      if (count >= groupLimit) continue;

      let session = sessionCache.get(row.session_id);
      if (session === undefined) {
        session = this.getSession(row.session_id);
        sessionCache.set(row.session_id, session);
      }
      if (!session) continue;

      perSession.set(row.session_id, count + 1);
      hits.push({ event: eventFromRow(row), session, score: row.score });
    }

    return hits;
  }

  listCitations(): HistoryCitation[] {
    const rows = this.db.prepare(`SELECT * FROM citations`).all() as {
      event_id: number;
      source_path: string;
      source_line: number | null;
    }[];
    return rows.map((r) => ({
      eventId: r.event_id,
      sourcePath: r.source_path,
      sourceLine: r.source_line ?? undefined,
    }));
  }

  close(): void {
    this.db.close();
  }
}
