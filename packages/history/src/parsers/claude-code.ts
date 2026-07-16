import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { glob } from "glob";
import type { HistoryImportResult, HistorySource, IHistoryParser } from "../types.js";

export interface ClaudeCodeParserOptions {
  /** Root directory to scan for transcript files. Default: ~/.claude/projects */
  root?: string;
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

function extractContent(message: { role?: string; content?: unknown } | undefined): {
  content: string;
  toolName?: string;
} {
  const raw = message?.content;
  if (typeof raw === "string") return { content: raw };
  if (Array.isArray(raw)) {
    const blocks = raw as ContentBlock[];
    const text = blocks
      .map((b) => {
        if (b.type === "text") return b.text ?? "";
        if (b.type === "tool_use") return `[tool_use:${b.name}] ${JSON.stringify(b.input ?? {})}`;
        if (b.type === "tool_result") return typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        return "";
      })
      .filter(Boolean)
      .join("\n");
    const toolUse = blocks.find((b) => b.type === "tool_use");
    return { content: text, toolName: toolUse?.name };
  }
  return { content: "" };
}

export function defaultClaudeCodeRoot(): string {
  return join(homedir(), ".claude", "projects");
}

async function parseTranscriptFile(
  file: string,
  provider: string,
  scope: string | undefined
): Promise<HistoryImportResult | null> {
  const raw = await readFile(file, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  const events: HistoryImportResult["events"] = [];
  const citations: HistoryImportResult["citations"] = [];
  let ordinal = 0;

  lines.forEach((line, lineIndex) => {
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      return;
    }
    const type = typeof entry.type === "string" ? entry.type : undefined;
    const message = entry.message as { role?: string; content?: unknown } | undefined;
    if (!message || (type !== "user" && type !== "assistant")) return;

    const { content, toolName } = extractContent(message);
    if (!content) return;

    const timestamp = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;

    events.push({
      role: message.role ?? type ?? "user",
      content,
      toolName,
      ordinal: ordinal++,
      timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    });
    citations.push({ sourcePath: file, sourceLine: lineIndex + 1 });
  });

  if (events.length === 0) return null;

  const sourceSessionId =
    file
      .replace(/\.jsonl$/, "")
      .split(/[/\\]/)
      .pop() ?? file;

  return {
    session: {
      id: `${provider}:${scope ?? ""}:${sourceSessionId}`,
      provider,
      sourceSessionId,
      importedAt: Date.now(),
      scope,
    },
    events,
    citations,
  };
}

/**
 * Parser for the JSONL transcript-tree format: one *.jsonl file per session, one JSON
 * object per line. Tolerant of unknown/missing fields — lines that can't be read as a
 * transcript entry are skipped rather than failing the whole import.
 *
 * Discovery is project-scoped: each immediate subdirectory of the root is treated as one
 * project (its own HistorySource, scope = subdirectory name), so a caller can import or
 * search one project's history without pulling in every other project on the machine.
 */
export class ClaudeCodeHistoryParser implements IHistoryParser {
  readonly provider = "claude-code";
  private root: string;

  constructor(options: ClaudeCodeParserOptions = {}) {
    this.root = options.root ?? defaultClaudeCodeRoot();
  }

  async discover(): Promise<HistorySource[]> {
    const id = `${this.provider}:${this.root}`;
    const base: Omit<HistorySource, "importable" | "reason"> = {
      id,
      provider: this.provider,
      path: this.root,
      nativeImport: true,
    };

    let entries: Dirent[];
    try {
      const info = await stat(this.root);
      if (!info.isDirectory()) {
        return [{ ...base, importable: false, reason: "path is not a directory" }];
      }
      entries = await readdir(this.root, { withFileTypes: true });
    } catch {
      return [{ ...base, importable: false, reason: "history directory not found" }];
    }

    const sources: HistorySource[] = [];

    // Loose transcripts directly under root (no project subdirectory) — unscoped.
    const looseFiles = await glob("*.jsonl", { cwd: this.root });
    if (looseFiles.length > 0) {
      sources.push({ ...base, importable: true });
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(this.root, entry.name);
      const files = await glob("**/*.jsonl", { cwd: dir });
      if (files.length === 0) continue;
      sources.push({
        id: `${this.provider}:${dir}`,
        provider: this.provider,
        path: dir,
        nativeImport: true,
        importable: true,
        scope: entry.name,
      });
    }

    if (sources.length === 0) {
      return [{ ...base, importable: false, reason: "no .jsonl transcripts found" }];
    }
    return sources;
  }

  async import(source: HistorySource): Promise<HistoryImportResult[]> {
    const files = await glob("**/*.jsonl", { cwd: source.path, absolute: true });
    const results: HistoryImportResult[] = [];

    for (const file of files) {
      const result = await parseTranscriptFile(file, source.provider, source.scope);
      if (result) results.push(result);
    }

    return results;
  }
}
