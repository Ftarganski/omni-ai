import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HistoryStore } from "../src/store.js";
import type { HistoryImportResult } from "../src/types.js";

let root: string;
let store: HistoryStore;

function importResult(overrides: Partial<HistoryImportResult> = {}): HistoryImportResult {
  return {
    session: { id: "p:s1", provider: "p", sourceSessionId: "s1", importedAt: 1 },
    events: [{ role: "user", content: "hello world", ordinal: 0, timestamp: 1 }],
    citations: [{ sourcePath: "a.jsonl", sourceLine: 1 }],
    ...overrides,
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "omni-history-store-test-"));
  store = new HistoryStore({ path: join(root, "history.db") });
});

afterEach(async () => {
  store.close();
  await rm(root, { recursive: true, force: true });
});

describe("HistoryStore", () => {
  it("defaults the db path when no options are given (relative to cwd)", async () => {
    const cwdBefore = process.cwd();
    const tmpCwd = await mkdtemp(join(tmpdir(), "omni-history-cwd-"));
    process.chdir(tmpCwd);
    try {
      const defaultStore = new HistoryStore();
      defaultStore.close();
    } finally {
      process.chdir(cwdBefore);
      await rm(tmpCwd, { recursive: true, force: true });
    }
  });

  it("lists sources, optionally filtered by provider, mapping reason/scope fallbacks", () => {
    store.upsertSource({ id: "a", provider: "claude-code", path: "/x", nativeImport: true, importable: true });
    store.upsertSource({
      id: "b",
      provider: "codex",
      path: "/y",
      nativeImport: true,
      importable: false,
      reason: "no history",
    });

    expect(
      store
        .listSources()
        .map((s) => s.id)
        .sort()
    ).toEqual(["a", "b"]);
    expect(store.listSources("codex")).toEqual([
      { id: "b", provider: "codex", path: "/y", nativeImport: true, importable: false, reason: "no history" },
    ]);
  });

  it("saves an event with no matching citation without throwing", () => {
    store.saveImportResult("p", "p:s1", importResult({ citations: [] }));
    expect(store.listEvents("p:s1")).toHaveLength(1);
    expect(store.getCitation(store.listEvents("p:s1")[0].id)).toBeNull();
  });

  it("returns null for a session/event/citation that doesn't exist", () => {
    expect(store.getSession("missing")).toBeNull();
    expect(store.getEvent(999)).toBeNull();
    expect(store.getEventWindow(999, 3)).toEqual([]);
    expect(store.getCitation(999)).toBeNull();
  });

  it("lists sessions filtered by provider, by scope, by both, and unfiltered", () => {
    store.saveImportResult(
      "p",
      "p:s1",
      importResult({ session: { id: "p:s1", provider: "p", sourceSessionId: "s1", importedAt: 1, scope: "proj-a" } })
    );
    store.saveImportResult(
      "q",
      "q:s2",
      importResult({ session: { id: "q:s2", provider: "q", sourceSessionId: "s2", importedAt: 2, scope: "proj-b" } })
    );

    expect(
      store
        .listSessions()
        .map((s) => s.id)
        .sort()
    ).toEqual(["p:s1", "q:s2"]);
    expect(store.listSessions({ provider: "p" }).map((s) => s.id)).toEqual(["p:s1"]);
    expect(store.listSessions({ scope: "proj-b" }).map((s) => s.id)).toEqual(["q:s2"]);
    expect(store.listSessions({ provider: "p", scope: "proj-a" }).map((s) => s.id)).toEqual(["p:s1"]);
    expect(store.listSessions({ provider: "p", scope: "proj-b" })).toEqual([]);
  });

  it("search restricts by sessionId, honors limit, and dedupes the session cache across grouped hits", () => {
    store.saveImportResult(
      "p",
      "p:s1",
      importResult({
        session: { id: "p:s1", provider: "p", sourceSessionId: "s1", importedAt: 1 },
        events: [
          { role: "user", content: "database retry logic", ordinal: 0, timestamp: 1 },
          { role: "assistant", content: "database retry with backoff", ordinal: 1, timestamp: 2 },
          { role: "user", content: "more database retry details", ordinal: 2, timestamp: 3 },
        ],
        citations: [{ sourcePath: "a.jsonl" }, { sourcePath: "a.jsonl" }, { sourcePath: "a.jsonl" }],
      })
    );
    store.saveImportResult(
      "p",
      "p:s2",
      importResult({
        session: { id: "p:s2", provider: "p", sourceSessionId: "s2", importedAt: 2 },
        events: [{ role: "user", content: "database retry elsewhere", ordinal: 0, timestamp: 1 }],
        citations: [{ sourcePath: "b.jsonl" }],
      })
    );

    // Restrict to one session
    const scoped = store.search('"database"', { sessionId: "p:s1" });
    expect(scoped.every((h) => h.session.id === "p:s1")).toBe(true);

    // groupLimit caps hits per session (s1 has 3 matches, cap at 2) while cache is reused across rows
    const grouped = store.search('"database"', { groupLimit: 2 });
    expect(grouped.filter((h) => h.session.id === "p:s1")).toHaveLength(2);

    // limit caps total hits across all sessions
    const limited = store.search('"database"', { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it("lists citations including entries without a source line", () => {
    store.saveImportResult(
      "p",
      "p:s1",
      importResult({
        events: [
          { role: "user", content: "a", ordinal: 0, timestamp: 1 },
          { role: "user", content: "b", ordinal: 1, timestamp: 2 },
        ],
        citations: [{ sourcePath: "a.json" }, { sourcePath: "a.jsonl", sourceLine: 5 }],
      })
    );

    const citations = store.listCitations();
    expect(citations).toHaveLength(2);
    expect(citations.find((c) => c.sourcePath === "a.json")?.sourceLine).toBeUndefined();
    expect(citations.find((c) => c.sourcePath === "a.jsonl")?.sourceLine).toBe(5);
  });
});
