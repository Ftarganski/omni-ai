export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

// --- Completion ---

export interface CompletionRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: string;
}

// --- Embedding ---

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: string;
}

// --- Provider ---

export interface ProviderCapabilities {
  chat: boolean;
  embedding: boolean;
  streaming: boolean;
  toolUse: boolean;
  vision: boolean;
}

export interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  stream?(request: CompletionRequest): AsyncGenerator<string>;
}

// --- Skill ---

export interface SkillContext {
  provider: IProvider;
  config: Record<string, unknown>;
}

export interface ISkill<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput, ctx: SkillContext): Promise<TOutput>;
}

// --- Agent ---

export interface AgentConfig {
  name: string;
  description: string;
  provider?: string;
  model?: string;
  systemPrompt: string;
  skills?: string[];
  maxIterations?: number;
  temperature?: number;
}

export interface AgentRunOptions {
  input: string;
  context?: Record<string, unknown>;
}

export interface AgentRunResult {
  output: string;
  iterations: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface IAgent {
  readonly config: AgentConfig;
  run(options: AgentRunOptions): Promise<AgentRunResult>;
}
