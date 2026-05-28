import { createRuntime } from "@omni-ai/core";
import { searchCodeSkill } from "@omni-ai/skills/code";
import { listDirectorySkill, readFileSkill, writeFileSkill } from "@omni-ai/skills/fs";
import { gitCommitMessageSkill, gitDiffSkill, gitLogSkill, gitStatusSkill } from "@omni-ai/skills/git";
import chalk from "chalk";
import chokidar from "chokidar";
import { resolveConfigPath } from "../utils/config-path.js";
import { agentHeader, errorLine, iterationLine, tokenSummary } from "../utils/format.js";

import "@omni-ai/provider-anthropic";
import "@omni-ai/provider-openai";
import "@omni-ai/provider-google";

interface WatchOptions {
  config?: string;
  glob?: string;
  debounce?: string;
  stream?: boolean;
}

export function buildDebounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

async function runOnce(agent: string, prompt: string, configPath: string, stream: boolean): Promise<void> {
  const skills = [
    readFileSkill,
    writeFileSkill,
    listDirectorySkill,
    searchCodeSkill,
    gitStatusSkill,
    gitDiffSkill,
    gitLogSkill,
    gitCommitMessageSkill,
  ];

  const runtime = await createRuntime({ configPath, skills }).catch((err: unknown) => {
    console.error(errorLine(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
    return null;
  });

  if (!runtime) return;

  const providerLabel = `${runtime.config.defaultProvider} / ${runtime.config.providers.find((p) => p.name === runtime.config.defaultProvider)?.defaultModel ?? "default"}`;
  console.log(`\n${agentHeader(agent, providerLabel)}`);

  const onToken = stream ? (chunk: string) => process.stdout.write(chunk) : undefined;
  if (stream) process.stdout.write("\n");

  const result = await runtime.run(agent, prompt, { onToken }).catch((err: unknown) => {
    console.error(errorLine(err instanceof Error ? err.message : String(err)));
    return null;
  });

  if (!result) return;

  if (stream) {
    process.stdout.write("\n");
  } else {
    console.log(`\n${result.output}\n`);
  }

  console.log(iterationLine(result.iterations));
  if (result.usage) console.log(tokenSummary(result.usage.inputTokens, result.usage.outputTokens));
}

export async function watchCommand(agent: string, prompt: string, opts: WatchOptions): Promise<void> {
  const configPath = opts.config ?? resolveConfigPath();
  const glob = opts.glob ?? "src/**/*.{ts,js,yaml,json}";
  const debounceMs = opts.debounce ? Number.parseInt(opts.debounce, 10) : 500;

  console.log(chalk.bold.cyan(`\n◆ omni watch`));
  console.log(chalk.gray(`  agent:    ${agent}`));
  console.log(chalk.gray(`  glob:     ${glob}`));
  console.log(chalk.gray(`  debounce: ${debounceMs}ms`));
  console.log(chalk.gray("  Press Ctrl+C to stop.\n"));

  // Run once immediately on start
  await runOnce(agent, prompt, configPath, opts.stream ?? false);

  const trigger = buildDebounce(async () => {
    console.log(chalk.gray(`\n  ↻ Rerunning ${agent}...`));
    await runOnce(agent, prompt, configPath, opts.stream ?? false);
  }, debounceMs);

  const watcher = chokidar.watch(glob, { ignoreInitial: true, ignored: /node_modules/ });

  watcher.on("change", (file) => {
    console.log(chalk.gray(`\n  ✎ Changed: ${file}`));
    trigger();
  });

  watcher.on("add", (file) => {
    console.log(chalk.gray(`\n  + Added: ${file}`));
    trigger();
  });

  watcher.on("error", (err) => {
    console.error(errorLine(`Watcher error: ${err}`));
  });

  // Keep process alive; exit cleanly on Ctrl+C
  process.on("SIGINT", async () => {
    console.log(chalk.gray("\n\n  Stopping watcher..."));
    await watcher.close();
    process.exit(0);
  });

  // Block forever
  await new Promise<never>(() => {});
}
