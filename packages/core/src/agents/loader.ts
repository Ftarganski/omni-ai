import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { OmniAiConfig } from "../config/schema.js";
import { AgentConfigSchema } from "../config/schema.js";
import { buildProvider } from "../providers/registry.js";
import type { SkillRegistry } from "../skills/registry.js";
import { Agent } from "./agent.js";

export async function loadAgent(yamlPath: string, config: OmniAiConfig, skills: SkillRegistry): Promise<Agent> {
  const raw = await readFile(yamlPath, "utf-8");
  const data = YAML.parse(raw) as unknown;
  const agentConfig = AgentConfigSchema.parse(data);

  const providerName = agentConfig.provider ?? config.defaultProvider;
  const providerConfig = config.providers.find((p) => p.name === providerName);
  if (!providerConfig) {
    throw new Error(
      `Provider "${providerName}" not found in config. Available: ${config.providers.map((p) => p.name).join(", ")}`
    );
  }

  const provider = buildProvider(providerConfig, config.providers);
  const resolvedSkills = (agentConfig.skills ?? []).map((name) => skills.get(name));

  return new Agent(agentConfig, provider, resolvedSkills);
}
