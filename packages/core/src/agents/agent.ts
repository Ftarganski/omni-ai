import {
  type AgentConfig,
  type AgentRunOptions,
  type AgentRunResult,
  contentToString,
  type IAgent,
  type IMemoryStore,
  type IProvider,
  type ISkill,
  type MemoryEntry,
  type Message,
  type SessionId,
  type SkillContext,
  type ToolCall,
  type ToolDefinition,
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
    const memCfg = this.config.memory;
    const session = options.session;
    const store = memCfg?.store;
    const compactor = memCfg?.compactor;
    const maxCtxTokens = memCfg?.maxContextTokens ?? 80_000;

    // Load history from store and build initial messages array
    const history: Message[] =
      session && store ? (await store.loadMessages(session)).map((e) => ({ role: e.role, content: e.content })) : [];

    const messages: Message[] = [...history];
    // Track only messages added in this run for persistence
    const newMessages: Message[] = [];

    const firstMsg: Message = { role: "user", content: options.input };
    messages.push(firstMsg);
    newMessages.push(firstMsg);

    const tools: ToolDefinition[] = this.buildToolDefinitions();
    const ctx: SkillContext = { provider: this.provider, config: options.context ?? {} };
    const maxIterations = this.config.maxIterations ?? 10;

    let iterations = 0;
    let totalInput = 0;
    let totalOutput = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Compact in-session context if threshold exceeded
      if (compactor?.shouldCompact(messages, maxCtxTokens)) {
        const compacted = await compactor.compact(messages, this.provider);
        messages.splice(0, messages.length, ...compacted);
      }

      const response = await this.provider.complete({
        messages,
        model: this.config.model,
        systemPrompt: this.config.systemPrompt,
        temperature: this.config.temperature,
        tools: tools.length > 0 ? tools : undefined,
        onToken: options.onToken,
      });

      if (response.usage) {
        totalInput += response.usage.inputTokens;
        totalOutput += response.usage.outputTokens;
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        const finalMsg: Message = { role: "assistant", content: response.content };
        messages.push(finalMsg);
        newMessages.push(finalMsg);
        await this.persist(store, session, newMessages);
        return {
          output: response.content,
          iterations,
          usage: { inputTokens: totalInput, outputTokens: totalOutput },
        };
      }

      const assistantMsg: Message = { role: "assistant", content: response.content };
      messages.push(assistantMsg);
      newMessages.push(assistantMsg);

      for (const call of response.toolCalls) {
        const result = await this.executeToolCall(call, ctx);
        const toolMsg: Message = { role: "user", content: `[Tool ${call.name} result]: ${result}` };
        messages.push(toolMsg);
        newMessages.push(toolMsg);
      }
    }

    await this.persist(store, session, newMessages);
    throw new Error(`Agent "${this.config.name}" exceeded maxIterations (${maxIterations})`);
  }

  private async persist(
    store: IMemoryStore | undefined,
    session: SessionId | undefined,
    messages: Message[]
  ): Promise<void> {
    if (!store || !session || messages.length === 0) return;
    const entries: MemoryEntry[] = messages.map((m) => ({
      role: m.role,
      content: contentToString(m.content),
      timestamp: Date.now(),
    }));
    await store.saveMessages(session, entries);
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
