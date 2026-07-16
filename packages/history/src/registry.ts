import type { IHistoryParser } from "./types.js";

/**
 * Registry of IHistoryParser implementations, one per provider. Provider-agnostic by
 * design — the registry only knows the provider string, never a specific format.
 */
export class HistoryParserRegistry {
  private parsers = new Map<string, IHistoryParser>();

  register(parser: IHistoryParser): void {
    this.parsers.set(parser.provider, parser);
  }

  get(provider: string): IHistoryParser | undefined {
    return this.parsers.get(provider);
  }

  list(): IHistoryParser[] {
    return [...this.parsers.values()];
  }
}
