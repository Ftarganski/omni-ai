import { glob } from "glob";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import YAML from "yaml";
import { loadConfig } from "./config/loader.js";
import { SkillRegistry } from "./skills/registry.js";
import { loadAgent } from "./agents/loader.js";
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

  async function resolveAgentPath(nameOrPath: string): Promise<string> {
    if (nameOrPath.includes("/") || nameOrPath.endsWith(".yaml")) {
      return resolve(nameOrPath);
    }
    const files = await glob("**/*.yaml", { cwd: agentsBaseDir, absolute: true });
    for (const file of files) {
      const raw = await readFile(file, "utf-8");
      const data = YAML.parse(raw) as { name?: string };
      if (data?.name === nameOrPath) return file;
    }
    throw new Error(`Agent "${nameOrPath}" not found in ${agentsBaseDir}`);
  }

  return {
    config,
    skills,

    async run(nameOrPath, input, opts = {}) {
      const agentPath = await resolveAgentPath(nameOrPath);
      const agent = await loadAgent(agentPath, config, skills);
      // Inject shared memory store when session is provided and config has none
      if (options?.memoryStore && opts.session && !agent.config.memory?.store) {
        (agent.config as { memory?: { store?: IMemoryStore } }).memory = {
          ...agent.config.memory,
          store: options.memoryStore,
        };
      }
      return agent.run({ ...opts, input });
    },

    async listAgents(agentsDir?: string) {
      const dir = agentsDir ?? agentsBaseDir;
      const files = await glob("**/*.yaml", { cwd: dir, absolute: true });
      const summaries: AgentSummary[] = [];
      for (const file of files) {
        try {
          const raw = await readFile(file, "utf-8");
          const data = YAML.parse(raw) as { name?: string; description?: string };
          if (data?.name) {
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
