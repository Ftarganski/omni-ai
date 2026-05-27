import { readFile, writeFile } from "node:fs/promises";
import { createRuntime } from "@omni-ai/core";
import { searchCodeSkill } from "@omni-ai/skills/code";
import { listDirectorySkill, readFileSkill, writeFileSkill } from "@omni-ai/skills/fs";
import chalk from "chalk";
import { resolveConfigPath } from "../utils/config-path.js";
import { agentHeader, errorLine } from "../utils/format.js";

import "@omni-ai/provider-anthropic";
import "@omni-ai/provider-openai";
import "@omni-ai/provider-google";

export interface EvalCase {
  input: string;
  expected: string;
}

export interface EvalResult {
  input: string;
  expected: string;
  actual: string;
  match: "exact" | "contains" | "miss";
}

export interface EvalReport {
  agent: string;
  total: number;
  passed: number;
  score: number;
  cases: EvalResult[];
}

interface EvalOptions {
  config?: string;
  concurrency?: string;
  output?: string;
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchCase(expected: string, actual: string): "exact" | "contains" | "miss" {
  const normExpected = normalize(expected);
  const normActual = normalize(actual);
  if (normActual === normExpected) return "exact";
  if (normActual.includes(normExpected)) return "contains";
  return "miss";
}

export function buildReport(agent: string, results: EvalResult[]): EvalReport {
  const passed = results.filter((r) => r.match !== "miss").length;
  return {
    agent,
    total: results.length,
    passed,
    score: results.length > 0 ? passed / results.length : 0,
    cases: results,
  };
}

async function runBatch(
  cases: EvalCase[],
  runFn: (c: EvalCase) => Promise<EvalResult>,
  concurrency: number,
  onResult: (r: EvalResult, index: number, total: number) => void
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  let index = 0;

  while (index < cases.length) {
    const batch = cases.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(runFn));
    for (const r of batchResults) {
      results.push(r);
      onResult(r, results.length, cases.length);
    }
    index += concurrency;
  }

  return results;
}

export async function evalCommand(agent: string, datasetPath: string, opts: EvalOptions): Promise<void> {
  const configPath = opts.config ?? resolveConfigPath();
  const concurrency = opts.concurrency ? Number.parseInt(opts.concurrency, 10) : 3;

  let cases: EvalCase[];
  try {
    const raw = await readFile(datasetPath, "utf-8");
    cases = JSON.parse(raw) as EvalCase[];
  } catch (err) {
    console.error(errorLine(`Failed to read dataset: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  if (!Array.isArray(cases) || cases.length === 0) {
    console.error(errorLine("Dataset must be a non-empty JSON array of { input, expected } objects."));
    process.exit(1);
  }

  const skills = [readFileSkill, writeFileSkill, listDirectorySkill, searchCodeSkill];
  const runtime = await createRuntime({ configPath, skills }).catch((err: unknown) => {
    console.error(errorLine(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  });

  const providerLabel = `${runtime.config.defaultProvider} / ${runtime.config.providers.find((p) => p.name === runtime.config.defaultProvider)?.defaultModel ?? "default"}`;

  console.log(`\n${agentHeader(agent, providerLabel)}`);
  console.log(chalk.gray(`  Dataset: ${datasetPath} (${cases.length} cases, concurrency ${concurrency})\n`));

  const matchSymbol = (m: EvalResult["match"]) => {
    if (m === "exact") return chalk.green("✓");
    if (m === "contains") return chalk.yellow("~");
    return chalk.red("✖");
  };

  const results = await runBatch(
    cases,
    async (c) => {
      const result = await runtime.run(agent, c.input).catch((err: unknown) => ({
        output: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        iterations: 0,
      }));
      const match = matchCase(c.expected, result.output);
      return { input: c.input, expected: c.expected, actual: result.output, match };
    },
    concurrency,
    (r, done, total) => {
      console.log(`  ${matchSymbol(r.match)}  ${String(done).padStart(String(total).length)}/${total}  [${r.match}]`);
    }
  );

  const report = buildReport(agent, results);
  const scoreColor = report.score >= 0.8 ? chalk.green : report.score >= 0.5 ? chalk.yellow : chalk.red;
  const misses = report.total - report.passed;

  console.log(
    `\n${chalk.bold("Resultado:")} ${scoreColor(`${report.passed}/${report.total} (${Math.round(report.score * 100)}%)`)}  · ${misses === 0 ? chalk.green("0 erros") : chalk.red(`${misses} erros`)}\n`
  );

  if (opts.output) {
    await writeFile(opts.output, JSON.stringify(report, null, 2), "utf-8");
    console.log(chalk.green(`Report saved to: ${opts.output}`));
  }
}
