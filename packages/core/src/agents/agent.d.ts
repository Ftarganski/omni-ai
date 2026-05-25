import type { IAgent, IProvider, ISkill, AgentConfig, AgentRunOptions, AgentRunResult } from "../types.js";
export declare class Agent implements IAgent {
    readonly config: AgentConfig;
    private provider;
    private skills;
    constructor(config: AgentConfig, provider: IProvider, skills?: ISkill[]);
    run(options: AgentRunOptions): Promise<AgentRunResult>;
    private persist;
    private buildToolDefinitions;
    private executeToolCall;
}
//# sourceMappingURL=agent.d.ts.map