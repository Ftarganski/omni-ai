import chalk from "chalk";
import { createRuntime, getRegisteredProviders } from "@omni-ai/core";
import { resolveConfigPath } from "../utils/config-path.js";

export async function listCommand(
  target: string,
  opts: { config?: string }
): Promise<void> {
  const configPath = opts.config ?? resolveConfigPath();

  if (target === "providers") {
    // Import providers to trigger registration side-effects
    await import("@omni-ai/provider-anthropic");
    await import("@omni-ai/provider-openai");
    const names = getRegisteredProviders();
    console.log(chalk.bold("Registered providers:"));
    for (const name of names) {
      console.log(`  ${chalk.cyan("·")} ${name}`);
    }
    return;
  }

  const runtime = await createRuntime({ configPath }).catch(() => null);

  if (target === "agents") {
    if (!runtime) {
      console.error(chalk.red("Could not load config. Run from the omni-ai directory or pass --config."));
      process.exit(1);
    }
    const agents = await runtime.listAgents();
    if (agents.length === 0) {
      console.log(chalk.gray("No agents found."));
      return;
    }
    console.log(chalk.bold(`Agents (${agents.length}):\n`));
    for (const agent of agents) {
      console.log(`  ${chalk.cyan(agent.name.padEnd(30))} ${chalk.gray(agent.description)}`);
    }
    return;
  }

  if (target === "skills") {
    if (!runtime) {
      console.error(chalk.red("Could not load config."));
      process.exit(1);
    }
    const skills = runtime.skills.all();
    if (skills.length === 0) {
      console.log(chalk.gray("No skills registered."));
      return;
    }
    console.log(chalk.bold(`Skills (${skills.length}):\n`));
    for (const skill of skills) {
      console.log(`  ${chalk.yellow(skill.name.padEnd(25))} ${chalk.gray(skill.description)}`);
    }
    return;
  }

  console.error(chalk.red(`Unknown list target: "${target}". Use: agents | skills | providers`));
  process.exit(1);
}
