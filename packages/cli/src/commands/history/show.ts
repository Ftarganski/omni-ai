import { writeFile } from "node:fs/promises";
import type { HistoryEvent, HistorySession } from "@omni-ai/history";
import chalk from "chalk";
import { openHistoryStore } from "./shared.js";

interface ShowEventOptions {
  window?: string;
}

interface ShowSessionOptions {
  format?: "text" | "markdown";
  out?: string;
}

export async function historyShowEventCommand(id: string, opts: ShowEventOptions): Promise<void> {
  const store = openHistoryStore();
  try {
    const eventId = Number.parseInt(id, 10);
    const window = opts.window ? Number.parseInt(opts.window, 10) : 3;
    const events = store.getEventWindow(eventId, window);

    if (events.length === 0) {
      console.error(chalk.red(`Event ${id} not found.`));
      process.exitCode = 1;
      return;
    }

    for (const e of events) {
      const marker = e.id === eventId ? chalk.bold.cyan(">") : " ";
      console.log(`${marker} ${chalk.cyan(`#${e.id}`)} ${chalk.gray(e.role.padEnd(10))} ${e.content.slice(0, 300)}`);
    }
  } finally {
    store.close();
  }
}

function formatSessionMarkdown(session: HistorySession, events: HistoryEvent[]): string {
  const lines = [
    `# Session: ${session.provider} / ${session.sourceSessionId}`,
    `_Imported: ${new Date(session.importedAt).toISOString()}_`,
    "",
  ];
  for (const e of events) {
    lines.push(`### ${e.role} — #${e.id}`, "", e.content, "");
  }
  return lines.join("\n");
}

function formatSessionText(session: HistorySession, events: HistoryEvent[]): string {
  const header = `Session: ${session.provider} / ${session.sourceSessionId}`;
  return [header, "", ...events.map((e) => `[${e.role}] ${e.content}`)].join("\n\n");
}

export async function historyShowSessionCommand(sessionId: string, opts: ShowSessionOptions): Promise<void> {
  const store = openHistoryStore();
  try {
    const session = store.getSession(sessionId);
    if (!session) {
      console.error(chalk.red(`Session "${sessionId}" not found.`));
      process.exitCode = 1;
      return;
    }

    const events = store.listEvents(sessionId);
    const format = opts.format ?? "text";
    const output = format === "markdown" ? formatSessionMarkdown(session, events) : formatSessionText(session, events);

    if (opts.out) {
      await writeFile(opts.out, output, "utf-8");
      console.log(chalk.green(`Session exported to: ${opts.out}`));
    } else {
      console.log(output);
    }
  } finally {
    store.close();
  }
}
