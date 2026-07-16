import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { glob } from "glob";
import { encodeProjectScope } from "../skills.js";
import type { HistoryImportResult, HistorySource, IHistoryParser } from "../types.js";

export interface CodexParserOptions {
  /** Root directory to scan for session state files. Default: ~/.codex/sessions */
  root?: string;
}

interface CodexMessage {
  role?: string;
  content?: string;
  toolName?: string;
  timestamp?: string;
}

interface CodexSessionFile {
  id?: string;
  /** Absolute path of the project this session ran in — used to derive scope. */
  cwd?: string;
  messages?: CodexMessage[];
}

export function defaultCodexRoot(): string {
  return join(homedir(), ".codex", "sessions");
}

/**
 * Parser for the state-file format: one whole-file JSON document per session (as opposed
 * to claude-code's JSONL-per-line transcript tree). Each file is parsed and re-serialized
 * as a whole, not line-by-line — exercising a structurally different provider format
 * against the same IHistoryParser contract. Scope comes from the `cwd` recorded inside
 * each session file rather than from directory layout.
 */
export class CodexHistoryParser implements IHistoryParser {
  readonly provider = "codex";
  private root: string;

  constructor(options: CodexParserOptions = {}) {
    this.root = options.root ?? defaultCodexRoot();
  }

  async discover(): Promise<HistorySource[]> {
    const id = `${this.provider}:${this.root}`;
    const base: Omit<HistorySource, "importable" | "reason"> = {
      id,
      provider: this.provider,
      path: this.root,
      nativeImport: true,
    };

    try {
      const info = await stat(this.root);
      if (!info.isDirectory()) {
        return [{ ...base, importable: false, reason: "path is not a directory" }];
      }
    } catch {
      return [{ ...base, importable: false, reason: "history directory not found" }];
    }

    const files = await glob("*.json", { cwd: this.root });
    if (files.length === 0) {
      return [{ ...base, importable: false, reason: "no session state files found" }];
    }
    return [{ ...base, importable: true }];
  }

  async import(source: HistorySource): Promise<HistoryImportResult[]> {
    const files = await glob("*.json", { cwd: source.path, absolute: true });
    const results: HistoryImportResult[] = [];

    for (const file of files) {
      let parsed: CodexSessionFile;
      try {
        parsed = JSON.parse(await readFile(file, "utf-8"));
      } catch {
        continue;
      }

      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const events: HistoryImportResult["events"] = [];
      const citations: HistoryImportResult["citations"] = [];
      let ordinal = 0;

      for (const m of messages) {
        if (!m || typeof m.content !== "string" || !m.content) continue;
        const timestamp = typeof m.timestamp === "string" ? Date.parse(m.timestamp) : Number.NaN;
        events.push({
          role: m.role ?? "user",
          content: m.content,
          toolName: m.toolName,
          ordinal: ordinal++,
          timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
        });
        // Whole-file state format has no line-level granularity — citation points at the file.
        citations.push({ sourcePath: file });
      }

      if (events.length === 0) continue;

      const sourceSessionId =
        parsed.id ??
        file
          .replace(/\.json$/, "")
          .split(/[/\\]/)
          .pop() ??
        file;
      const scope = parsed.cwd ? encodeProjectScope(parsed.cwd) : undefined;

      results.push({
        session: {
          id: `${source.provider}:${scope ?? ""}:${sourceSessionId}`,
          provider: source.provider,
          sourceSessionId,
          importedAt: Date.now(),
          scope,
        },
        events,
        citations,
      });
    }

    return results;
  }
}
