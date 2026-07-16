import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { searchHistorySkill, showEventSkill } from "../src/skills.js";
import { HistoryStore } from "../src/store.js";

let root: string;
let dbPath: string;
let originalHome: string | undefined;

const ctx = {} as never;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "omni-history-skills-test-"));
  dbPath = join(root, ".omni-ai", "history.db");
  originalHome = process.env.HOME;
  process.env.HOME = root;

  const store = new HistoryStore({ path: dbPath });
  store.saveImportResult("claude-code", "claude-code:project-a:s1", {
    session: {
      id: "claude-code:project-a:s1",
      provider: "claude-code",
      sourceSessionId: "s1",
      importedAt: 1,
      scope: "project-a",
    },
    events: [{ role: "user", content: "project A: rotate the API key", ordinal: 0, timestamp: 1 }],
    citations: [{ sourcePath: "a.jsonl", sourceLine: 1 }],
  });
  store.saveImportResult("claude-code", "claude-code:project-b:s2", {
    session: {
      id: "claude-code:project-b:s2",
      provider: "claude-code",
      sourceSessionId: "s2",
      importedAt: 1,
      scope: "project-b",
    },
    events: [{ role: "user", content: "project B: rotate the API key too", ordinal: 0, timestamp: 1 }],
    citations: [{ sourcePath: "b.jsonl", sourceLine: 1 }],
  });
  store.close();
});

afterEach(async () => {
  process.env.HOME = originalHome;
  await rm(root, { recursive: true, force: true });
});

describe("searchHistorySkill", () => {
  it("is scoped to the given project by default", async () => {
    const result = await searchHistorySkill.execute({ query: '"rotate"', scope: "project-a" }, ctx);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].session.scope).toBe("project-a");
  });

  it("searches every project when allProjects is set", async () => {
    const result = await searchHistorySkill.execute({ query: '"rotate"', allProjects: true }, ctx);
    expect(result.hits.length).toBeGreaterThanOrEqual(2);
  });
});

describe("showEventSkill", () => {
  it("refuses to show an event from a different project scope", async () => {
    const store = new HistoryStore({ path: dbPath });
    const otherProjectEvent = store.search('"too"', { scope: "project-b" })[0].event;
    store.close();

    await expect(showEventSkill.execute({ eventId: otherProjectEvent.id, allProjects: false }, ctx)).rejects.toThrow(
      /different project scope/
    );
  });

  it("allows cross-scope reads when allProjects is explicitly set", async () => {
    const store = new HistoryStore({ path: dbPath });
    const otherProjectEvent = store.search('"too"', { scope: "project-b" })[0].event;
    store.close();

    const result = await showEventSkill.execute({ eventId: otherProjectEvent.id, allProjects: true }, ctx);
    expect(result.events.length).toBeGreaterThan(0);
  });
});
