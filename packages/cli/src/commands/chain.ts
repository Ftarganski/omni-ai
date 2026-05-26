import { writeFile } from "fs/promises";
import chalk from "chalk";
import { createRuntime } from "@omni-ai/core";
import { readFileSkill, writeFileSkill, listDirectorySkill } from "@omni-ai/skills-fs";
import { searchCodeSkill } from "@omni-ai/skills-code";
import { auditAccessibilitySkill } from "@omni-ai/skills-ux";
import { resolveConfigPath } from "../utils/config-path.js";
import {
  agentHeader,
  iterationLine,
  tokenSummary,
  errorLine,
  savedLine,
} from "../utils/format.js";

import "@omni-ai/provider-anthropic";
import "@omni-ai/provider-openai";

interface ChainOptions {
  config?: string;
  output?: string;
  verbose?: boolean;
}

export async function chainCommand(
  prompt: string,
  agents: string[],
  opts: ChainOptions
): Promise<void> {
  if (agents.length < 2) {
    console.error(errorLine("omni chain requires at least 2 agents"));
    process.exit(1);
  }

  const configPath = opts.config ?? resolveConfigPath();

  const skills = [
    readFileSkill,
    writeFileSkill,
    listDirectorySkill,
    searchCodeSkill,
    auditAccessibilitySkill,
  ];

  let runtime;
  try {
    runtime = await createRuntime({ configPath, skills });
  } catch (err) {
    console.error(errorLine(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  const providerLabel = `${runtime.config.defaultProvider} / ${runtime.config.providers.find((p) => p.name === runtime.config.defaultProvider)?.defaultModel ?? "default"}`;

  let currentInput = prompt;
  let totalInput = 0;
  let totalOutput = 0;
  let lastOutput = "";

  console.log();

  for (let i = 0; i < agents.length; i++) {
    const agentName = agents[i];
    console.log(agentHeader(agentName, providerLabel));

    let result;
    try {
      result = await runtime.run(agentName, currentInput);
    } catch (err) {
      console.error(errorLine(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    console.log(iterationLine(result.iterations));

    if (opts.verbose) {
      console.log("\n" + result.output + "\n");
    }

    if (result.usage) {
      totalInput += result.usage.inputTokens;
      totalOutput += result.usage.outputTokens;
    }

    lastOutput = result.output;
    currentInput = result.output;

    if (i < agents.length - 1) {
      console.log(chalk.gray(`\n  ↓  saída passada para: `) + chalk.cyan(agents[i + 1]) + "\n");
    }
  }

  console.log("\n" + lastOutput + "\n");

  if (opts.output) {
    await writeFile(opts.output, lastOutput, "utf-8");
    console.log(savedLine(opts.output));
  }

  if (totalInput > 0 || totalOutput > 0) {
    console.log(tokenSummary(totalInput, totalOutput));
  }

  console.log();
}
