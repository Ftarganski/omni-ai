import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Target project root directory"),
  runner: z.enum(["jest", "vitest"]).default("vitest").describe("Test runner used by the target project"),
  command: z
    .string()
    .optional()
    .describe("Override the command used to run tests (defaults to a JSON-reporter invocation of `runner`)"),
  previousCoverage: z
    .object({
      lines: z.number(),
      statements: z.number(),
      branches: z.number(),
      functions: z.number(),
    })
    .optional()
    .describe("Coverage summary from a previous run, used to compute coverageDelta"),
});

export type RunTestsInput = z.infer<typeof InputSchema>;

export interface TestFileResult {
  file: string;
  status: "passed" | "failed";
  failureMessages: string[];
}

export interface CoverageSummary {
  lines: number;
  statements: number;
  branches: number;
  functions: number;
}

export interface RunTestsResult {
  runner: "jest" | "vitest";
  total: number;
  passed: number;
  failed: number;
  files: TestFileResult[];
  coverage?: CoverageSummary;
  coverageDelta?: CoverageSummary;
}

interface JsonAssertionResult {
  status: string;
  failureMessages?: string[];
}

interface JsonTestResult {
  name: string;
  status: string;
  message?: string;
  assertionResults?: JsonAssertionResult[];
}

interface JsonReporterOutput {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults?: JsonTestResult[];
}

function defaultCommand(runner: "jest" | "vitest"): string {
  return runner === "jest" ? "npx jest --json" : "npx vitest run --reporter=json";
}

function runShell(command: string, cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, { cwd, shell: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("close", () => {
      // Test runners exit non-zero when tests fail — that is a valid result, not a skill error.
      const out = Buffer.concat(stdout).toString();
      if (out.trim()) {
        resolvePromise(out);
      } else {
        reject(new Error(Buffer.concat(stderr).toString().trim() || `${command} produced no output`));
      }
    });
    proc.on("error", reject);
  });
}

export function parseTestOutput(raw: string): Omit<RunTestsResult, "runner" | "coverage" | "coverageDelta"> {
  const jsonStart = raw.indexOf("{");
  const parsed = JSON.parse(jsonStart > 0 ? raw.slice(jsonStart) : raw) as JsonReporterOutput;
  const testResults = parsed.testResults ?? [];

  const files: TestFileResult[] = testResults.map((result) => {
    const failureMessages =
      result.assertionResults?.filter((a) => a.status === "failed").flatMap((a) => a.failureMessages ?? []) ?? [];
    if (failureMessages.length === 0 && result.status === "failed" && result.message) {
      failureMessages.push(result.message);
    }
    return {
      file: result.name,
      status: result.status === "passed" ? "passed" : "failed",
      failureMessages,
    };
  });

  const passed = parsed.numPassedTests ?? files.filter((f) => f.status === "passed").length;
  const failed = parsed.numFailedTests ?? files.filter((f) => f.status === "failed").length;
  const total = parsed.numTotalTests ?? passed + failed;

  return { total, passed, failed, files };
}

async function readCoverageSummary(cwd: string): Promise<CoverageSummary | undefined> {
  try {
    const raw = await readFile(join(cwd, "coverage", "coverage-summary.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      total?: Record<string, { pct: number }>;
    };
    const total = parsed.total;
    if (!total) return undefined;
    return {
      lines: total.lines?.pct ?? 0,
      statements: total.statements?.pct ?? 0,
      branches: total.branches?.pct ?? 0,
      functions: total.functions?.pct ?? 0,
    };
  } catch {
    return undefined;
  }
}

function coverageDelta(current: CoverageSummary, previous: CoverageSummary): CoverageSummary {
  return {
    lines: current.lines - previous.lines,
    statements: current.statements - previous.statements,
    branches: current.branches - previous.branches,
    functions: current.functions - previous.functions,
  };
}

export const runTestsSkill: ISkill<RunTestsInput, RunTestsResult> = {
  name: "run-tests",
  description:
    "Run the target project's test suite (jest or vitest) and return a structured pass/fail result per file, " +
    "plus the current coverage summary and its delta against a previously recorded coverage. " +
    "Use this to validate generated code end-to-end, complementing the static analyze-test-coverage skill.",

  async execute(input: RunTestsInput): Promise<RunTestsResult> {
    const { cwd, runner, command, previousCoverage } = InputSchema.parse(input);
    const dir = resolve(cwd);

    const raw = await runShell(command ?? defaultCommand(runner), dir);
    const parsed = parseTestOutput(raw);
    const coverage = await readCoverageSummary(dir);

    return {
      runner,
      ...parsed,
      ...(coverage ? { coverage } : {}),
      ...(coverage && previousCoverage ? { coverageDelta: coverageDelta(coverage, previousCoverage) } : {}),
    };
  },
};
