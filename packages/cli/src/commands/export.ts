import { writeFile } from "node:fs/promises";
import { SQLiteMemoryStore } from "@omni-ai/memory";
import chalk from "chalk";

interface ExportOptions {
  format?: "markdown" | "json";
  output?: string;
  limit?: string;
}

function getDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.omni-ai/sessions.db`;
}

export function formatAsMarkdown(
  session: { resourceId: string; threadId: string },
  messages: Array<{ role: string; content: string; timestamp: number }>
): string {
  const lines: string[] = [
    `# Session: ${session.resourceId} / ${session.threadId}`,
    `_Exported: ${new Date().toISOString()}_`,
    "",
  ];

  for (const msg of messages) {
    const ts = new Date(msg.timestamp).toISOString();
    const label = msg.role === "user" ? chalk.cyan("**user**") : chalk.yellow("**assistant**");
    lines.push(`### ${label} — ${ts}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatAsJson(
  session: { resourceId: string; threadId: string },
  messages: Array<{ role: string; content: string; timestamp: number }>
): string {
  return JSON.stringify({ session, messages }, null, 2);
}

export async function exportCommand(sessionArg: string, opts: ExportOptions): Promise<void> {
  const [resourceId, ...rest] = sessionArg.split(":");
  const threadId = rest.join(":") || "default";
  const session = { resourceId, threadId };

  const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined;
  const format = opts.format ?? "markdown";

  const store = new SQLiteMemoryStore({ path: getDbPath() });

  let messages: Array<{ role: string; content: string; timestamp: number }>;
  try {
    messages = await store.loadMessages(session, limit);
  } finally {
    await store.close?.();
  }

  if (messages.length === 0) {
    console.log(chalk.gray(`No messages found for session "${sessionArg}".`));
    return;
  }

  const output = format === "json" ? formatAsJson(session, messages) : formatAsMarkdown(session, messages);

  if (opts.output) {
    await writeFile(opts.output, output, "utf-8");
    console.log(chalk.green(`Session exported to: ${opts.output}`));
  } else {
    console.log(output);
  }

  console.log(chalk.gray(`\n${messages.length} message(s) exported.`));
}
