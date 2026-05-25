import { SkillRegistry } from "./skills/registry.js";
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
export declare function createRuntime(options?: {
    configPath?: string;
    skills?: ISkill[];
    memoryStore?: IMemoryStore;
}): Promise<Runtime>;
//# sourceMappingURL=bootstrap.d.ts.map