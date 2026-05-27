import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import YAML from "yaml";
import { agentWizard } from "./new/scaffold-agent.js";
import { providerWizard } from "./new/scaffold-provider.js";
import { skillWizard } from "./new/scaffold-skill.js";

interface ScaffoldConfig {
  agentsDir: string;
  skills: string;
  providers: string;
}

const DEFAULTS: ScaffoldConfig = {
  agentsDir: "agents",
  skills: "src/skills",
  providers: "packages",
};

async function loadScaffoldConfig(): Promise<ScaffoldConfig> {
  try {
    const raw = await readFile(join(process.cwd(), "config", "omni-ai.yaml"), "utf-8");
    const data = YAML.parse(raw) as Record<string, unknown> | null;
    if (!data) return DEFAULTS;
    const sp = data.scaffoldPaths as Record<string, string> | undefined;
    return {
      agentsDir: (data.agentsDir as string) ?? DEFAULTS.agentsDir,
      skills: sp?.skills ?? DEFAULTS.skills,
      providers: sp?.providers ?? DEFAULTS.providers,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function newCommand(): Promise<void> {
  console.log();
  console.log(chalk.bold("  omni new — scaffold interativo"));
  console.log(chalk.dim("  Cria um agente, skill ou provider a partir de template"));

  const config = await loadScaffoldConfig();

  const type = await select({
    message: "O que deseja criar?",
    choices: [
      { value: "agent", name: "Agent    — arquivo YAML que define um agente de IA" },
      { value: "skill", name: "Skill    — função TypeScript que o agente pode chamar" },
      { value: "provider", name: "Provider — adapter para uma nova API de LLM" },
    ],
  });

  switch (type) {
    case "agent":
      await agentWizard(config.agentsDir);
      break;
    case "skill":
      await skillWizard(config.skills);
      break;
    case "provider":
      await providerWizard(config.providers);
      break;
  }
}
