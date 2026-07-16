// --- Normalized history model ---
// A "source" is a provider-owned history location on disk (a directory or file).
// A "session" groups the events imported from one conversation within a source.
// A "citation" points an event back at the original provider file/line it came from.

export interface HistorySource {
  id: string;
  provider: string;
  path: string;
  /** Whether omni-ai has parser support for this provider's format. */
  nativeImport: boolean;
  /** Whether the source actually exists and is readable on this machine right now. */
  importable: boolean;
  /** Why importable is false (missing history, empty file, unsupported schema, ...). */
  reason?: string;
  /**
   * Provider-defined isolation key (e.g. project directory, workspace id). Sessions inherit
   * their source's scope. Search and MCP skills default to the caller's own scope so an agent
   * working in one project never surfaces another project's imported history by accident.
   */
  scope?: string;
}

export interface HistorySession {
  id: string;
  provider: string;
  /** The session/conversation id as known to the provider (filename, uuid, ...). */
  sourceSessionId: string;
  importedAt: number;
  scope?: string;
}

export interface HistoryEvent {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  toolName?: string;
  /** Position of this event within its session, ascending. */
  ordinal: number;
  timestamp: number;
}

export interface HistoryCitation {
  eventId: number;
  sourcePath: string;
  sourceLine?: number;
}

export interface HistoryImportResult {
  session: HistorySession;
  events: Omit<HistoryEvent, "id" | "sessionId">[];
  citations: Omit<HistoryCitation, "eventId">[];
}

/**
 * One parser per provider history format (JSONL transcript tree, SQLite, state files, ...).
 * Parsers only read provider-owned history — never write to it, call model APIs, or require API keys.
 */
export interface IHistoryParser {
  readonly provider: string;
  /** Reports what this parser can see on the current machine, without importing anything. */
  discover(): Promise<HistorySource[]>;
  /** Reads and normalizes every session found under `source`. */
  import(source: HistorySource): Promise<HistoryImportResult[]>;
}

export interface HistorySearchHit {
  event: HistoryEvent;
  session: HistorySession;
  score: number;
}
