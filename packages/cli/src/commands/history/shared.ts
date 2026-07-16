import { ClaudeCodeHistoryParser, CodexHistoryParser, HistoryParserRegistry, HistoryStore } from "@omni-ai/history";

export { encodeProjectScope } from "@omni-ai/history";

export function getHistoryDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.omni-ai/history.db`;
}

/** Registers every provider parser omni-ai ships. */
export function buildHistoryRegistry(): HistoryParserRegistry {
  const registry = new HistoryParserRegistry();
  registry.register(new ClaudeCodeHistoryParser());
  registry.register(new CodexHistoryParser());
  return registry;
}

export function openHistoryStore(): HistoryStore {
  return new HistoryStore({ path: getHistoryDbPath() });
}
