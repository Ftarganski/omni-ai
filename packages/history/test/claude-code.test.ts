import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeCodeHistoryParser } from "../src/parsers/claude-code.js";
import { HistoryStore } from "../src/store.js";

let root: string;
let dbPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "omni-history-test-"));
  dbPath = join(root, "history.db");
  await writeFile(
    join(root, "session-1.jsonl"),
    [
      JSON.stringify({
        type: "user",
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "how do I retry a failed fetch?" },
      }),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-01-01T00:00:01.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "use exponential backoff with jitter" }] },
      }),
      "not json, should be skipped",
      JSON.stringify({ type: "summary", message: undefined }),
    ].join("\n"),
    "utf-8"
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("ClaudeCodeHistoryParser + HistoryStore", () => {
  it("discovers the root as importable when transcripts exist", async () => {
    const parser = new ClaudeCodeHistoryParser({ root });
    const sources = await parser.discover();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ provider: "claude-code", importable: true });
  });

  it("reports not importable when the root has no transcripts", async () => {
    const emptyRoot = join(root, "empty");
    await import("node:fs/promises").then((fs) => fs.mkdir(emptyRoot));
    const parser = new ClaudeCodeHistoryParser({ root: emptyRoot });
    const sources = await parser.discover();
    expect(sources[0].importable).toBe(false);
  });

  it("imports events, skipping unparsable lines, and persists them to the store", async () => {
    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);
    expect(results).toHaveLength(1);
    expect(results[0].events).toHaveLength(2);

    const store = new HistoryStore({ path: dbPath });
    try {
      store.upsertSource(source);
      store.saveImportResult(source.provider, results[0].session.id, results[0]);

      const events = store.listEvents(results[0].session.id);
      expect(events.map((e) => e.role)).toEqual(["user", "assistant"]);
      expect(events[1].content).toContain("exponential backoff");

      const citation = store.getCitation(events[0].id);
      expect(citation?.sourcePath).toMatch(/session-1\.jsonl$/);
      expect(citation?.sourceLine).toBe(1);

      const hits = store.search("backoff");
      expect(hits).toHaveLength(1);
      expect(hits[0].session.id).toBe(results[0].session.id);
    } finally {
      store.close();
    }
  });

  it("re-importing the same session is idempotent (regression: FK violation on re-import)", async () => {
    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const store = new HistoryStore({ path: dbPath });
    try {
      const firstPass = await parser.import(source);
      store.saveImportResult(source.provider, firstPass[0].session.id, firstPass[0]);

      const secondPass = await parser.import(source);
      expect(() => store.saveImportResult(source.provider, secondPass[0].session.id, secondPass[0])).not.toThrow();

      const events = store.listEvents(secondPass[0].session.id);
      expect(events).toHaveLength(2);
    } finally {
      store.close();
    }
  });

  it("scopes discovery and search per project subdirectory", async () => {
    await mkdir(join(root, "project-a"));
    await mkdir(join(root, "project-b"));
    await writeFile(
      join(root, "project-a", "session-a.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "project A: how do I configure the payment gateway?" },
      }),
      "utf-8"
    );
    await writeFile(
      join(root, "project-b", "session-b.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "project B: how do I configure the payment gateway?" },
      }),
      "utf-8"
    );

    const parser = new ClaudeCodeHistoryParser({ root });
    const sources = await parser.discover();
    const scopes = sources.map((s) => s.scope).sort();
    expect(scopes).toEqual([undefined, "project-a", "project-b"].sort());

    const store = new HistoryStore({ path: dbPath });
    try {
      for (const source of sources) {
        store.upsertSource(source);
        for (const result of await parser.import(source)) {
          store.saveImportResult(source.provider, result.session.id, result);
        }
      }

      const scopedToA = store.search('"payment"', { scope: "project-a" });
      expect(scopedToA).toHaveLength(1);
      expect(scopedToA[0].session.scope).toBe("project-a");

      const unscoped = store.search('"payment"');
      expect(unscoped.length).toBeGreaterThanOrEqual(2);
    } finally {
      store.close();
    }
  });

  it("extracts tool_use/tool_result blocks, skips unknown block types, and handles a missing text field", async () => {
    await writeFile(
      join(root, "tools.jsonl"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-01-01T00:00:00.000Z",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", name: "Bash", input: { command: "ls" } },
            { type: "tool_result", content: "file1\nfile2" },
            { type: "tool_result", content: { ok: true } },
            { type: "thinking" },
            { type: "text" },
          ],
        },
      }),
      "utf-8"
    );

    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);
    const toolsEvent = results.flatMap((r) => r.events).find((e) => e.toolName === "Bash");

    expect(toolsEvent).toBeDefined();
    expect(toolsEvent?.content).toContain("[tool_use:Bash]");
    expect(toolsEvent?.content).toContain("file1\nfile2");
    expect(toolsEvent?.content).toContain('{"ok":true}');
  });

  it("falls back to type/'user' for role and Date.now() for timestamp when both are missing", async () => {
    await writeFile(
      join(root, "no-role.jsonl"),
      JSON.stringify({ type: "user", message: { content: "no role or timestamp field" } }),
      "utf-8"
    );

    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);
    const event = results.flatMap((r) => r.events).find((e) => e.content === "no role or timestamp field");

    expect(event?.role).toBe("user");
    expect(event?.timestamp).toBeGreaterThan(0);
  });

  it("skips entries whose type isn't user/assistant even when message is present", async () => {
    await writeFile(
      join(root, "system.jsonl"),
      JSON.stringify({ type: "system", message: { role: "system", content: "should be ignored" } }),
      "utf-8"
    );

    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);
    expect(results.flatMap((r) => r.events).some((e) => e.content === "should be ignored")).toBe(false);
  });

  it("excludes a file from results entirely when every line is invalid or empty", async () => {
    await writeFile(
      join(root, "empty-session.jsonl"),
      [
        "not json at all",
        JSON.stringify({ type: "user", message: { role: "user", content: "" } }),
        JSON.stringify({ type: "summary", message: undefined }),
      ].join("\n"),
      "utf-8"
    );

    const parser = new ClaudeCodeHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);
    expect(results.some((r) => r.session.sourceSessionId === "empty-session")).toBe(false);
  });

  it("reports not importable when the root path exists but is a file, not a directory", async () => {
    const filePath = join(root, "not-a-dir.txt");
    await writeFile(filePath, "hi", "utf-8");
    const parser = new ClaudeCodeHistoryParser({ root: filePath });
    const sources = await parser.discover();
    expect(sources[0]).toMatchObject({ importable: false, reason: "path is not a directory" });
  });

  it("skips a project subdirectory that has no .jsonl transcripts", async () => {
    await mkdir(join(root, "empty-project"));
    await writeFile(join(root, "empty-project", "notes.txt"), "hi", "utf-8");

    const parser = new ClaudeCodeHistoryParser({ root });
    const sources = await parser.discover();
    expect(sources.some((s) => s.scope === "empty-project")).toBe(false);
  });

  it("defaults to defaultClaudeCodeRoot() when no root option is given", async () => {
    const parser = new ClaudeCodeHistoryParser();
    const sources = await parser.discover();
    expect(Array.isArray(sources)).toBe(true);
  });
});
