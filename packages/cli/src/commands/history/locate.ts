import { existsSync } from "node:fs";
import chalk from "chalk";
import { openHistoryStore } from "./shared.js";

interface LocateOptions {
  json?: boolean;
}

export async function historyLocateEventCommand(id: string, opts: LocateOptions): Promise<void> {
  const store = openHistoryStore();
  try {
    const eventId = Number.parseInt(id, 10);
    const event = store.getEvent(eventId);
    if (!event) {
      console.error(chalk.red(`Event ${id} not found.`));
      process.exitCode = 1;
      return;
    }

    const citation = store.getCitation(eventId);
    if (!citation) {
      console.error(chalk.yellow(`No citation recorded for event ${id}.`));
      process.exitCode = 1;
      return;
    }

    const exists = existsSync(citation.sourcePath);
    if (opts.json) {
      console.log(JSON.stringify({ citation, exists }, null, 2));
      return;
    }

    console.log(`${citation.sourcePath}${citation.sourceLine ? `:${citation.sourceLine}` : ""}`);
    if (!exists) console.log(chalk.yellow("  ! source file no longer exists at this path"));
  } finally {
    store.close();
  }
}

export async function historyLocateSessionCommand(sessionId: string, opts: LocateOptions): Promise<void> {
  const store = openHistoryStore();
  try {
    const events = store.listEvents(sessionId);
    if (events.length === 0) {
      console.error(chalk.red(`Session "${sessionId}" not found or has no events.`));
      process.exitCode = 1;
      return;
    }

    const citation = store.getCitation(events[0].id);
    if (!citation) {
      console.error(chalk.yellow("No citation recorded for this session."));
      process.exitCode = 1;
      return;
    }

    const exists = existsSync(citation.sourcePath);
    if (opts.json) {
      console.log(JSON.stringify({ citation, exists }, null, 2));
      return;
    }

    console.log(citation.sourcePath);
    if (!exists) console.log(chalk.yellow("  ! source file no longer exists at this path"));
  } finally {
    store.close();
  }
}
