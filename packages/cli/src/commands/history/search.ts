import type { HistoryStore } from "@omni-ai/history";
import chalk from "chalk";
import { buildHistoryRegistry, encodeProjectScope, openHistoryStore } from "./shared.js";

type RefreshMode = "auto" | "off" | "strict";

interface SearchOptions {
  term?: string[];
  session?: string;
  scope?: string;
  allProjects?: boolean;
  json?: boolean;
  limit?: string;
  refresh?: RefreshMode;
}

interface Freshness {
  mode: RefreshMode;
  ran: boolean;
  error?: string;
}

/**
 * Bounded, best-effort re-import before searching. Scope-bounded by default: discover()
 * only lists what's on disk (directory names, no content read), but only sources matching
 * `scope` are actually imported — so a plain `omni history search` run from inside one
 * project never reads another project's transcripts off disk, even transiently. Pass
 * `scope: undefined` (--all-projects) to explicitly opt into a full, unbounded refresh.
 */
async function refresh(mode: RefreshMode, store: HistoryStore, scope: string | undefined): Promise<Freshness> {
  if (mode === "off") return { mode, ran: false };

  const registry = buildHistoryRegistry();
  try {
    for (const parser of registry.list()) {
      const sources = await parser.discover();
      const inScope = scope === undefined ? sources : sources.filter((s) => s.scope === scope);
      for (const source of inScope) {
        store.upsertSource(source);
        if (!source.importable) continue;
        const results = await parser.import(source);
        for (const result of results) store.saveImportResult(parser.provider, result.session.id, result);
      }
    }
    return { mode, ran: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (mode === "strict") throw new Error(message);
    return { mode, ran: false, error: message };
  }
}

function toFtsQuery(terms: string[]): string {
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

export async function historySearchCommand(query: string | undefined, opts: SearchOptions): Promise<void> {
  const terms = opts.term && opts.term.length > 0 ? opts.term : query ? [query] : [];
  if (terms.length === 0) {
    console.error(chalk.red('Provide a query, e.g. omni history search "retry handling", or repeatable --term.'));
    process.exitCode = 1;
    return;
  }

  const mode = opts.refresh ?? "auto";
  // Defaults to the caller's own project so history from other projects on the same machine
  // is never read off disk or surfaced by accident — pass --all-projects to search everything.
  const scope = opts.allProjects ? undefined : (opts.scope ?? encodeProjectScope(process.cwd()));

  const store = openHistoryStore();
  try {
    let freshness: Freshness;
    try {
      freshness = await refresh(mode, store, scope);
    } catch (err) {
      console.error(
        chalk.red(`Refresh failed (--refresh strict): ${err instanceof Error ? err.message : String(err)}`)
      );
      process.exitCode = 1;
      return;
    }

    const hits = store.search(toFtsQuery(terms), {
      sessionId: opts.session,
      scope,
      limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
    });

    if (opts.json) {
      console.log(JSON.stringify({ freshness, scope: scope ?? null, hits }, null, 2));
      return;
    }

    if (freshness.error) {
      console.log(chalk.gray(`  (refresh skipped: ${freshness.error})\n`));
    }

    console.log(chalk.gray(`  scope: ${scope ?? "(all projects)"}\n`));

    if (hits.length === 0) {
      console.log(chalk.gray("No results."));
      return;
    }

    for (const hit of hits) {
      console.log(
        `${chalk.cyan(`[${hit.session.provider}]`)} ${chalk.gray(hit.session.id)} ${chalk.gray(`#${hit.event.id}`)}`
      );
      console.log(`  ${hit.event.content.slice(0, 200).replace(/\n/g, " ")}\n`);
    }
  } finally {
    store.close();
  }
}
