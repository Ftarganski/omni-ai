import { existsSync } from "node:fs";
import chalk from "chalk";
import { openHistoryStore } from "./shared.js";

interface DoctorOptions {
  json?: boolean;
}

export async function historyDoctorCommand(opts: DoctorOptions): Promise<void> {
  const store = openHistoryStore();
  try {
    const sources = store.listSources();
    const sessions = store.listSessions();
    const citations = store.listCitations();

    const notImportable = sources.filter((s) => !s.importable);
    const pathExists = new Map<string, boolean>();
    let brokenCitations = 0;
    for (const citation of citations) {
      let exists = pathExists.get(citation.sourcePath);
      if (exists === undefined) {
        exists = existsSync(citation.sourcePath);
        pathExists.set(citation.sourcePath, exists);
      }
      if (!exists) brokenCitations++;
    }

    const report = {
      sources: sources.length,
      notImportable: notImportable.map((s) => ({ provider: s.provider, path: s.path, reason: s.reason })),
      sessions: sessions.length,
      events: citations.length,
      brokenCitations,
    };

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(chalk.bold("omni history doctor\n"));
    console.log(`  sources:          ${report.sources}`);
    console.log(`  not importable:   ${notImportable.length}`);
    for (const s of notImportable) {
      console.log(`    ${chalk.yellow("-")} ${s.provider}: ${s.reason} (${s.path})`);
    }
    console.log(`  sessions:         ${report.sessions}`);
    console.log(`  citations:        ${report.events}`);
    console.log(
      `  broken citations: ${brokenCitations > 0 ? chalk.yellow(String(brokenCitations)) : chalk.green("0")}`
    );
  } finally {
    store.close();
  }
}
