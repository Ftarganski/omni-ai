import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  stackTrace: z.string().describe("Raw error message/stack trace text to analyze"),
  directory: z.string().describe("Project root directory to correlate stack frames against"),
  contextLines: z.number().int().nonnegative().default(2).describe("Lines of source context around the probable cause"),
});

export type AnalyzeErrorLogsInput = z.infer<typeof InputSchema>;

export interface StackFrame {
  raw: string;
  file?: string;
  line?: number;
  column?: number;
  functionName?: string;
}

export interface ProbableCause {
  file: string;
  line: number;
  snippet: string;
}

export interface ErrorLogAnalysis {
  frames: StackFrame[];
  probableCause?: ProbableCause;
}

const FRAME_WITH_FN_RE = /at\s+(\S+)\s+\(([^():]+):(\d+):(\d+)\)/;
const FRAME_PLAIN_RE = /at\s+\(?([^():\s]+):(\d+):(\d+)\)?/;

export function parseStackTrace(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of stackTrace.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) continue;

    const withFn = FRAME_WITH_FN_RE.exec(trimmed);
    if (withFn) {
      const [, functionName, file, lineNo, column] = withFn;
      frames.push({ raw: trimmed, functionName, file, line: Number(lineNo), column: Number(column) });
      continue;
    }

    const plain = FRAME_PLAIN_RE.exec(trimmed);
    if (plain) {
      const [, file, lineNo, column] = plain;
      frames.push({ raw: trimmed, file, line: Number(lineNo), column: Number(column) });
      continue;
    }

    frames.push({ raw: trimmed });
  }
  return frames;
}

async function resolveFrameFile(directory: string, file: string): Promise<string | null> {
  const candidate = isAbsolute(file) ? file : join(directory, file);
  try {
    await readFile(candidate, "utf-8");
    return candidate;
  } catch {
    return null;
  }
}

async function buildProbableCause(
  directory: string,
  frames: StackFrame[],
  contextLines: number
): Promise<ProbableCause | undefined> {
  for (const frame of frames) {
    if (!frame.file || !frame.line || frame.file.includes("node_modules")) continue;

    const resolvedPath = await resolveFrameFile(directory, frame.file);
    if (!resolvedPath) continue;

    const content = await readFile(resolvedPath, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, frame.line - 1 - contextLines);
    const end = Math.min(lines.length, frame.line + contextLines);
    const snippet = lines.slice(start, end).join("\n");

    return { file: resolvedPath, line: frame.line, snippet };
  }
  return undefined;
}

export const analyzeErrorLogsSkill: ISkill<AnalyzeErrorLogsInput, ErrorLogAnalysis> = {
  name: "analyze-error-logs",
  description:
    "Parse a stack trace, correlate its frames with real source files under a project directory (skipping " +
    "node_modules), and surface the probable cause — the topmost frame that resolves to an existing file, with " +
    "the offending line and surrounding context. Use this to speed up debugging from a pasted error log.",

  async execute(input: AnalyzeErrorLogsInput): Promise<ErrorLogAnalysis> {
    const { stackTrace, directory, contextLines } = InputSchema.parse(input);
    const dir = resolve(directory);

    const frames = parseStackTrace(stackTrace);
    const probableCause = await buildProbableCause(dir, frames, contextLines);

    return { frames, probableCause };
  },
};
