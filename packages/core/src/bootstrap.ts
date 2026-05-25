import { glob } from "glob";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import YAML from "yaml";
import { loadConfig } from "./config/loader.js";
import { SkillRegistry } from "./skills/registry.js";
import { loadAgent } from "./agents/loader.js";
import { Agent } from "./agents/agent.js";
import { createProvider } from "./providers/registry.js";
import type { OmniAiConfig } from "./config/schema.js";
import type { ISkill, IMemoryStore, AgentRunOptions, AgentRunResult } from "./types.js";

export interface AgentSummary {
  name: string;
  description: string;
  path: string;
}

export interface Runtime {
  config: OmniAiConfig;
  skills: SkillRegistry;
  run(agentNameOrPath: string, input: string, opts?: Omit<AgentRunOptions, "input">): Promise<AgentRunResult>;
  listAgents(agentsDir?: string): Promise<AgentSummary[]>;
}

export async function createRuntime(options?: {
  configPath?: string;
  skills?: ISkill[];
  memoryStore?: IMemoryStore;
}): Promise<Runtime> {
  const config = await loadConfig(options?.configPath);

  const skills = new SkillRegistry();
  for (const skill of options?.skills ?? []) {
    skills.register(skill);
  }

  const configDir = options?.configPath
    ? dirname(resolve(options.configPath))
    : resolve(process.cwd(), "config");

  const agentsBaseDir = resolve(configDir, "..", config.agentsDir);

  async function resolveAgent(nameOrPath: string): Promise<Agent> {
    // Explicit path → load from file
    if (nameOrPath.includes("/") || nameOrPath.endsWith(".yaml")) {
      return loadAgent(resolve(nameOrPath), config, skills);
    }

    // Check inline agents defined inside omni-ai.yaml first
    const inlineCfg = config.agents?.find((a) => a.name === nameOrPath);
    if (inlineCfg) {
      const providerName = inlineCfg.provider ?? config.defaultProvider;
      const providerConfig = config.providers.find((p) => p.name === providerName);
      if (!providerConfig) {
        throw new Error(`Provider "${providerName}" not found in config for agent "${nameOrPath}"`);
      }
      const provider = createProvider(providerConfig);
      const resolvedSkills = (inlineCfg.skills ?? []).map((n) => skills.get(n));
      return new Agent(inlineCfg, provider, resolvedSkills);
    }

    // Fall back to files in agentsDir
    const files = await glob("**/*.yaml", { cwd: agentsBaseDir, absolute: true });
    for (const file of files) {
      const raw = await readFile(file, "utf-8");
      const data = YAML.parse(raw) as { name?: string };
      if (data?.name === nameOrPath) return loadAgent(file, config, skills);
    }
    throw new Error(`Agent "${nameOrPath}" not found in ${agentsBaseDir}`);
  }

  return {
    config,
    skills,

    async run(nameOrPath, input, opts = {}) {
      const agent = await resolveAgent(nameOrPath);
      // Inject shared memory store when session is provided and agent has no store configured
      if (options?.memoryStore && opts.session && !agent.config.memory?.store) {
        agent.config.memory = {
          ...(agent.config.memory ?? {}),
          store: options.memoryStore,
        };
      }
      return agent.run({ ...opts, input });
    },

    async listAgents(agentsDir?: string) {
      const summaries: AgentSummary[] = [];

      // Include inline agents from omni-ai.yaml
      for (const a of config.agents ?? []) {
        summaries.push({ name: a.name, description: a.description, path: "(config)" });
      }

      const dir = agentsDir ?? agentsBaseDir;
      const files = await glob("**/*.yaml", { cwd: dir, absolute: true });
      for (const file of files) {
        try {
          const raw = await readFile(file, "utf-8");
          const data = YAML.parse(raw) as { name?: string; description?: string };
          if (data?.name && !summaries.find((s) => s.name === data.name)) {
            summaries.push({ name: data.name, description: data.description ?? "", path: file });
          }
        } catch {
          // skip malformed files
        }
      }
      return summaries.sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
