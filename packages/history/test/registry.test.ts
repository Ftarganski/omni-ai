import { describe, expect, it } from "vitest";
import { HistoryParserRegistry } from "../src/registry.js";
import type { IHistoryParser } from "../src/types.js";

function fakeParser(provider: string): IHistoryParser {
  return {
    provider,
    discover: async () => [],
    import: async () => [],
  };
}

describe("HistoryParserRegistry", () => {
  it("registers and retrieves a parser by provider", () => {
    const registry = new HistoryParserRegistry();
    const parser = fakeParser("claude-code");
    registry.register(parser);
    expect(registry.get("claude-code")).toBe(parser);
  });

  it("returns undefined for an unregistered provider", () => {
    const registry = new HistoryParserRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("lists every registered parser", () => {
    const registry = new HistoryParserRegistry();
    registry.register(fakeParser("claude-code"));
    registry.register(fakeParser("codex"));
    expect(
      registry
        .list()
        .map((p) => p.provider)
        .sort()
    ).toEqual(["claude-code", "codex"]);
  });
});
