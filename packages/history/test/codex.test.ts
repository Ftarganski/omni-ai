import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodexHistoryParser } from "../src/parsers/codex.js";
import { HistoryStore } from "../src/store.js";

let root: string;
let dbPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "omni-codex-test-"));
  dbPath = join(root, "history.db");
  await writeFile(
    join(root, "session-1.json"),
    JSON.stringify({
      id: "session-1",
      cwd: "/home/dev/project-a",
      messages: [
        { role: "user", content: "how do I rate-limit this endpoint?", timestamp: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: "use a token bucket limiter", timestamp: "2026-01-01T00:00:01.000Z" },
        { role: "user", content: "" },
      ],
    }),
    "utf-8"
  );
  await writeFile(join(root, "not-json.json"), "{ this is not valid json", "utf-8");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("CodexHistoryParser + HistoryStore", () => {
  it("discovers the root as importable when session files exist", async () => {
    const parser = new CodexHistoryParser({ root });
    const sources = await parser.discover();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ provider: "codex", importable: true });
  });

  it("imports messages, skips empty content and unparsable files, and derives scope from cwd", async () => {
    const parser = new CodexHistoryParser({ root });
    const [source] = await parser.discover();
    const results = await parser.import(source);

    expect(results).toHaveLength(1);
    expect(results[0].events).toHaveLength(2);
    expect(results[0].session.scope).toBe("-home-dev-project-a");

    const store = new HistoryStore({ path: dbPath });
    try {
      store.saveImportResult(source.provider, results[0].session.id, results[0]);
      const events = store.listEvents(results[0].session.id);
      expect(events.map((e) => e.content)).toEqual([
        "how do I rate-limit this endpoint?",
        "use a token bucket limiter",
      ]);

      const citation = store.getCitation(events[0].id);
      expect(citation?.sourcePath).toMatch(/session-1\.json$/);
    } finally {
      store.close();
    }
  });
});
