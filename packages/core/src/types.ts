export type Role = "user" | "assistant" | "system";

// --- Memory ---

export interface SessionId {
  /** Stable identifier for the user or entity (e.g. user ID, workspace ID). */
  resourceId: string;
  /** Unique identifier for this conversation thread. */
  threadId: string;
}

export interface MemoryEntry {
  role: Role;
  content: string;
  timestamp: number;
}

export interface MemorySearchResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface IMemoryStore {
  saveMessages(session: SessionId, messages: MemoryEntry[]): Promise<void>;
  loadMessages(session: SessionId, limit?: number): Promise<MemoryEntry[]>;
  search?(session: SessionId, query: string, topK?: number): Promise<MemorySearchResult[]>;
  getWorkingMemory?(session: SessionId): Promise<string | null>;
  setWorkingMemory?(session: SessionId, content: string): Promise<void>;
  close?(): Promise<void>;
}

export interface ICompactor {
  shouldCompact(messages: Message[], maxTokens: number): boolean;
  compact(messages: Message[], provider: IProvider): Promise<Message[]>;
}

export interface MemoryConfig {
  store?: IMemoryStore;
  compactor?: ICompactor;
  /** Verbatim messages to keep when compacting. Default: 6 */
  lastMessages?: number;
  /** Token threshold that triggers compaction (at 70% of this value). Default: 80_000 */
  maxContextTokens?: number;
}

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
  memory?: MemoryConfig;
}

export interface AgentRunOptions {
  input: string;
  context?: Record<string, unknown>;
  /** Provide a session to enable message history persistence. */
  session?: SessionId;
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
