import type {
  IAgent,
  IProvider,
  ISkill,
  AgentConfig,
  AgentRunOptions,
  AgentRunResult,
  Message,
  SkillContext,
  ToolDefinition,
  ToolCall,
} from "../types.js";

export class Agent implements IAgent {
  readonly config: AgentConfig;
  private provider: IProvider;
  private skills: Map<string, ISkill>;

  constructor(config: AgentConfig, provider: IProvider, skills: ISkill[] = []) {
    this.config = config;
    this.provider = provider;
    this.skills = new Map(skills.map((s) => [s.name, s]));
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const messages: Message[] = [{ role: "user", content: options.input }];
    const tools: ToolDefinition[] = this.buildToolDefinitions();
    const ctx: SkillContext = { provider: this.provider, config: options.context ?? {} };
    const maxIterations = this.config.maxIterations ?? 10;

    let iterations = 0;
    let totalInput = 0;
    let totalOutput = 0;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.provider.complete({
        messages,
        model: this.config.model,
        systemPrompt: this.config.systemPrompt,
        temperature: this.config.temperature,
        tools: tools.length > 0 ? tools : undefined,
      });

      if (response.usage) {
        totalInput += response.usage.inputTokens;
        totalOutput += response.usage.outputTokens;
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          output: response.content,
          iterations,
          usage: { inputTokens: totalInput, outputTokens: totalOutput },
        };
      }

      messages.push({ role: "assistant", content: response.content });

      for (const call of response.toolCalls) {
        const result = await this.executeToolCall(call, ctx);
        messages.push({ role: "user", content: `[Tool ${call.name} result]: ${result}` });
      }
    }

    throw new Error(`Agent "${this.config.name}" exceeded maxIterations (${maxIterations})`);
  }

  private buildToolDefinitions(): ToolDefinition[] {
    return [...this.skills.values()].map((skill) => ({
      name: skill.name,
      description: skill.description,
      parameters: { type: "object", properties: {}, additionalProperties: true },
    }));
  }

  private async executeToolCall(call: ToolCall, ctx: SkillContext): Promise<string> {
    const skill = this.skills.get(call.name);
    if (!skill) return `Error: skill "${call.name}" not found`;
    try {
      const result = await skill.execute(call.arguments, ctx);
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
