import { basename } from "node:path";
import type { HistorySource } from "@omni-ai/history";
import chalk from "chalk";
import { buildHistoryRegistry, openHistoryStore } from "./shared.js";

interface ImportOptions {
  provider?: string;
  all?: boolean;
  path?: string;
}

export async function historyImportCommand(opts: ImportOptions): Promise<void> {
  if (!opts.all && !opts.provider) {
    console.error(chalk.red("Specify --provider <name> or --all."));
    process.exitCode = 1;
    return;
  }
  if (opts.path && (!opts.provider || opts.all)) {
    console.error(chalk.red("--path requires a single --provider (not --all)."));
    process.exitCode = 1;
    return;
  }

  const registry = buildHistoryRegistry();
  const parsers = opts.all
    ? registry.list()
    : (() => {
        const parser = opts.provider ? registry.get(opts.provider) : undefined;
        return parser ? [parser] : [];
      })();

  if (parsers.length === 0) {
    const known = registry
      .list()
      .map((p) => p.provider)
      .join(", ");
    console.error(chalk.red(`Unknown provider: "${opts.provider}". Registered: ${known || "(none)"}`));
    process.exitCode = 1;
    return;
  }

  const store = openHistoryStore();
  try {
    for (const parser of parsers) {
      const sources: HistorySource[] = opts.path
        ? [
            {
              id: `${parser.provider}:${opts.path}`,
              provider: parser.provider,
              path: opts.path,
              nativeImport: true,
              importable: true,
              scope: basename(opts.path),
            },
          ]
        : await parser.discover();

      for (const source of sources) {
        store.upsertSource(source);
        if (!source.importable) {
          console.log(chalk.yellow(`  - ${parser.provider}: skipped (${source.reason})`));
          continue;
        }

        const results = await parser.import(source);
        for (const result of results) {
          store.saveImportResult(parser.provider, result.session.id, result);
        }
        const eventCount = results.reduce((n, r) => n + r.events.length, 0);
        console.log(
          chalk.green(`  ✓ ${parser.provider}: imported ${results.length} session(s), ${eventCount} event(s)`)
        );
      }
    }
  } finally {
    store.close();
  }
}
