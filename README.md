# omni-ai

**Provider-agnostic AI agents and skills framework for TypeScript monorepos.**  
Configure any LLM provider (Anthropic, OpenAI, GitHub Copilot, or self-hosted) and compose reusable agents for your projects — backend generation, frontend components, UX review, QA validation, and more.

```
pnpm add @omni-ai/core
```

---

## How it works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        omni-ai.yaml                                 │
│                                                                     │
│  defaultProvider: anthropic                                         │
│                                                                     │
│  providers:                    agents:                              │
│  ┌──────────────────────┐      ┌────────────────────────────────┐   │
│  │ name: anthropic      │      │ name: backend-dev              │   │
│  │ type: anthropic      │      │ systemPrompt: "..."            │   │
│  │ apiKey: ${API_KEY}   │      │ skills: [read-file, write-file]│   │
│  │ defaultModel: claude │      │ maxIterations: 30              │   │
│  └──────────────────────┘      └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                │                               │
                ▼                               ▼
┌──────────────────────────┐    ┌───────────────────────────────────┐
│     ProviderRegistry     │    │          Agent (agentic loop)     │
│                          │    │                                   │
│  IProvider               │◄───│  1. Send systemPrompt + input     │
│  ┌──────────────────┐    │    │  2. Receive tool calls            │
│  │ complete()       │    │    │  3. Execute skills                │
│  │ embed()          │    │    │  4. Feed results back             │
│  │ stream()         │    │    │  5. Repeat until done / maxIter   │
│  └──────────────────┘    │    └───────────────────────────────────┘
└──────────────────────────┘                   │
         │                                     │
         ▼                                     ▼
  ┌─────────────┐                    ┌──────────────────┐
  │  Anthropic  │                    │     Skills       │
  │  OpenAI     │                    │  read-file       │
  │  Copilot    │                    │  write-file      │
  │  Custom     │                    │  search-code     │
  └─────────────┘                    │  list-directory  │
                                     │  audit-a11y      │
                                     └──────────────────┘
```

---

## Core concepts

| Concept | Description |
|---------|-------------|
| **Provider** | Adapter for an AI API. Implements `IProvider` with `complete()`, optional `embed()` and `stream()`. Configured in `omni-ai.yaml`. |
| **Skill** | A reusable capability an agent can call as a tool (read a file, search code, write output, etc.). Implements `ISkill<TInput, TOutput>`. |
| **Agent** | Combines a `systemPrompt` + `skills` list + iteration budget. Defined as YAML. Inherits `provider` and `model` from config defaults. |
| **Config** | Central `omni-ai.yaml` that declares available providers and the default one. Agents inherit from it unless they override. |

### Provider & model inheritance

```
omni-ai.yaml
  └─ defaultProvider: anthropic        ← applies to all agents
       └─ providers[anthropic]
            └─ defaultModel: claude-sonnet-4-6   ← applies to all agents

agent.yaml
  ├─ provider: (omitted)  →  uses defaultProvider
  ├─ provider: openai     →  overrides for this agent only
  ├─ model: (omitted)     →  uses defaultModel of resolved provider
  └─ model: gpt-4o-mini   →  overrides for this agent only
```

---

## Repository structure

```
omni-ai/
│
├── packages/                      # npm packages (pnpm workspaces)
│   ├── core/                      # @omni-ai/core — interfaces, registry, config schema
│   │   └── src/
│   │       ├── types.ts           # IProvider, ISkill, IAgent, IMemoryStore, ICompactor...
│   │       ├── config/schema.ts   # Zod schemas for omni-ai.yaml validation
│   │       ├── agents/agent.ts    # Base Agent implementation (agentic loop + memory)
│   │       ├── providers/         # ProviderRegistry
│   │       └── skills/            # SkillRegistry
│   │
│   ├── memory/                    # @omni-ai/memory — session memory & compaction
│   │   └── src/
│   │       ├── stores/
│   │       │   ├── in-memory.ts   # InMemoryStore (default, no persistence)
│   │       │   └── sqlite.ts      # SQLiteMemoryStore (local file, FTS5 search)
│   │       └── compactors/
│   │           ├── observation-masking.ts  # Mask old tool results (zero LLM cost)
│   │           └── summary.ts             # LLM-based history summarization
│   │
│   ├── skills-fs/                 # @omni-ai/skills-fs — filesystem skills
│   │   └── src/
│   │       ├── read-file.ts       # Read any file by path
│   │       ├── write-file.ts      # Write/overwrite a file
│   │       └── list-directory.ts  # List directory contents
│   │
│   ├── skills-code/               # @omni-ai/skills-code — code analysis skills
│   │   └── src/
│   │       └── search-code.ts     # Grep/ripgrep-based code search
│   │
│   └── skills-ux/                 # @omni-ai/skills-ux — UX audit skills
│       └── src/
│           └── audit-accessibility.ts  # Heuristic a11y scan of TSX files
│
├── agents/                        # Agent YAML definitions (23 agents)
│   ├── _template/agent.yaml       # Starter template for new agents
│   ├── backend/                   # NestJS/TypeScript backend agents (7)
│   ├── frontend/                  # React/TypeScript frontend agents (5)
│   ├── ux/                        # UX implementation agents (5)
│   └── qa/                        # QA validation agents (4)
│
├── providers/                     # Provider setup guides
│   ├── anthropic/README.md
│   ├── openai/README.md
│   └── copilot/README.md
│
├── skills/                        # Custom skill templates
│   └── _template/skill.ts
│
├── config/
│   └── omni-ai.example.yaml       # Configuration template (copy → omni-ai.yaml)
│
├── .env.example                   # Environment variable template
└── templates/                     # Additional scaffolding templates
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Ftarganski/omni-ai.git
cd omni-ai
pnpm install
```

### 2. Create your config

```bash
cp config/omni-ai.example.yaml config/omni-ai.yaml
```

Edit `config/omni-ai.yaml` and set your `defaultProvider` and the providers you want to use.

### 3. Set your API keys

```bash
cp .env.example .env
```

Edit `.env` and fill in the keys for the providers you configured.

### 4. Build

```bash
pnpm build
```

### 5. Use the core in your project

```typescript
import { Agent, ProviderRegistry } from "@omni-ai/core";

const registry = new ProviderRegistry();
registry.register(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }));

const agent = new Agent(agentConfig, registry, skillRegistry);
const result = await agent.run({ input: "Review this PR for security issues." });
console.log(result.output);
```

---

## Configuration reference

### `omni-ai.yaml` structure

```yaml
version: "1"

# All agents use this provider unless they declare their own
defaultProvider: anthropic

providers:
  - name: anthropic
    type: anthropic                      # "anthropic" | "openai" | "copilot" | "custom"
    apiKey: ${ANTHROPIC_API_KEY}         # env var reference — never hardcode keys
    defaultModel: claude-sonnet-4-6      # model used when agents don't specify one

  - name: openai
    type: openai
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4o

  - name: copilot
    type: copilot
    apiKey: ${GITHUB_TOKEN}
    baseUrl: https://api.githubcopilot.com
    defaultModel: gpt-4o

agents:
  # Minimal — inherits provider and model from defaults above
  - name: code-reviewer
    description: Reviews code for quality, bugs, and security issues
    systemPrompt: |
      You are an expert code reviewer...
    skills:
      - read-file
      - search-code
    maxIterations: 5

  # With explicit override — uses a different provider/model than the default
  - name: doc-writer
    description: Generates documentation
    provider: openai          # overrides defaultProvider for this agent only
    model: gpt-4o-mini        # overrides defaultModel for this agent only
    systemPrompt: |
      You are a technical writer...
    maxIterations: 3
```

### Agent YAML fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | required | Unique identifier |
| `description` | `string` | required | What the agent does |
| `provider` | `string` | inherits | Provider name — omit to use `defaultProvider` |
| `model` | `string` | inherits | Model ID — omit to use `defaultModel` |
| `systemPrompt` | `string` | required | The agent's instructions |
| `skills` | `string[]` | `[]` | Skill names the agent can call as tools |
| `maxIterations` | `number` | `10` | Maximum agentic loop iterations |
| `temperature` | `number` | provider default | Sampling temperature (0–2) |

---

## Providers

### Anthropic (Claude)

```yaml
# config/omni-ai.yaml
providers:
  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-sonnet-4-6
```

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Available models** (as of 2025):

| Model | ID | Best for |
|-------|----|----------|
| Claude Opus 4.7 | `claude-opus-4-7` | Complex reasoning, long context |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Balanced quality/speed (recommended) |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Fast, low-cost tasks |

Get your key: [console.anthropic.com](https://console.anthropic.com) → API Keys

---

### OpenAI (GPT)

```yaml
# config/omni-ai.yaml
providers:
  - name: openai
    type: openai
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4o
```

```bash
# .env
OPENAI_API_KEY=sk-proj-...
```

**Available models** (as of 2025):

| Model | ID | Best for |
|-------|----|----------|
| GPT-4o | `gpt-4o` | Multimodal, strong reasoning |
| GPT-4o mini | `gpt-4o-mini` | Fast, cost-efficient |
| o1 | `o1` | Advanced reasoning tasks |
| o3-mini | `o3-mini` | Fast reasoning |

Get your key: [platform.openai.com](https://platform.openai.com) → API keys

---

### GitHub Copilot

```yaml
# config/omni-ai.yaml
providers:
  - name: copilot
    type: copilot
    apiKey: ${GITHUB_TOKEN}
    baseUrl: https://api.githubcopilot.com
    defaultModel: gpt-4o
```

```bash
# .env
GITHUB_TOKEN=ghp_...
```

Get your token: [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic). No special scopes required for Copilot API access.

---

### Custom / self-hosted (Ollama, Groq, Azure, vLLM...)

Any endpoint that implements the OpenAI chat completions format works with `type: custom`:

```yaml
providers:
  - name: ollama
    type: custom
    baseUrl: ${CUSTOM_LLM_BASE_URL}     # e.g. http://localhost:11434/v1
    apiKey: ${CUSTOM_LLM_API_KEY}       # leave empty for Ollama
    defaultModel: llama3.2
```

```bash
# .env
CUSTOM_LLM_BASE_URL=http://localhost:11434/v1
CUSTOM_LLM_API_KEY=
```

Compatible endpoints: **Ollama**, **LM Studio**, **vLLM**, **Groq**, **Together AI**, **Azure OpenAI**, **Mistral AI**, **Perplexity**.

---

## Agent catalog

### Backend agents

| Agent | File | What it does |
|-------|------|--------------|
| `backend-dev` | `agents/backend/backend-dev.yaml` | Orchestrator — full NestJS feature from schema to tests |
| `backend-service` | `agents/backend/backend-service.yaml` | NestJS service with CRUD, events, error helpers |
| `backend-resolver` | `agents/backend/backend-resolver.yaml` | GraphQL resolver with federation patterns |
| `backend-schema` | `agents/backend/backend-schema.yaml` | DynamoDB entity schema with `defineSchema()` |
| `backend-listener` | `agents/backend/backend-listener.yaml` | Domain event listeners with `@OnEventCatcher` |
| `backend-test` | `agents/backend/backend-test.yaml` | Jest integration tests with real local DynamoDB |
| `backend-atom-app` | `agents/backend/backend-atom-app.yaml` | Atom framework connectors (sessions, ARNs, message routing) |

### Frontend agents

| Agent | File | What it does |
|-------|------|--------------|
| `frontend-dev` | `agents/frontend/frontend-dev.yaml` | Orchestrator — full React feature from route to components |
| `frontend-ui-component` | `agents/frontend/frontend-ui-component.yaml` | shadcn/ui-based primitive UI components |
| `frontend-module-component` | `agents/frontend/frontend-module-component.yaml` | Data-connected module components (TanStack Query) |
| `frontend-page-route` | `agents/frontend/frontend-page-route.yaml` | TanStack Router pages with layouts |
| `frontend-custom-hook` | `agents/frontend/frontend-custom-hook.yaml` | Custom React hooks (typed, SSR-safe) |

### UX agents

| Agent | File | What it does |
|-------|------|--------------|
| `ux-lead` | `agents/ux/ux-lead.yaml` | Orchestrator — full UX audit across 10 dimensions |
| `ux-reviewer` | `agents/ux/ux-reviewer.yaml` | Detailed UX review with severity-ranked findings |
| `ux-states` | `agents/ux/ux-states.yaml` | Loading / empty / error / success state components |
| `ux-forms` | `agents/ux/ux-forms.yaml` | Form UX — validation, autocomplete, accessibility |
| `ux-motion` | `agents/ux/ux-motion.yaml` | Animations with `motion-safe:`, timing, easing |

### QA agents

| Agent | File | What it does |
|-------|------|--------------|
| `qa-lead` | `agents/qa/qa-lead.yaml` | Orchestrator — routes files to the right QA agents, issues merge verdict |
| `qa-frontend` | `agents/qa/qa-frontend.yaml` | Validates React/TypeScript code (imports, Tailwind tokens, a11y) |
| `qa-ux` | `agents/qa/qa-ux.yaml` | Validates UX implementation (feedback, forms, states, motion) |
| `qa-backend` | `agents/qa/qa-backend.yaml` | Validates NestJS code (services, resolvers, schema, tests) |

---

## Available skills

| Skill | Package | Description |
|-------|---------|-------------|
| `read-file` | `@omni-ai/skills-fs` | Read any file by absolute path |
| `write-file` | `@omni-ai/skills-fs` | Write or overwrite a file |
| `list-directory` | `@omni-ai/skills-fs` | List files and subdirectories |
| `search-code` | `@omni-ai/skills-code` | Search codebase with regex (ripgrep) |
| `audit-accessibility` | `@omni-ai/skills-ux` | Heuristic a11y scan of TSX component files |

---

## Memory & context compaction

Install the memory package:

```bash
pnpm add @omni-ai/memory
```

### How it reduces token consumption

```
Without memory                     With ObservationMasking
──────────────────────────────     ──────────────────────────────
Iteration 1:  1 000 tokens         Iteration 1:  1 000 tokens
Iteration 2:  3 500 tokens         Iteration 2:  3 500 tokens
Iteration 3:  8 200 tokens   →     Iteration 3:  1 800 tokens  ← old tool results masked
Iteration 4: 14 000 tokens         Iteration 4:  2 100 tokens
Total:       26 700 tokens         Total:         8 400 tokens  (68% reduction)
```

### Compactors

| Class | Strategy | LLM calls | Best for |
|-------|----------|-----------|----------|
| `ObservationMaskingCompactor` | Replaces old tool result bodies with `[masked ~N tokens]` | 0 | Tool-heavy agents (file readers, code searchers) |
| `SummaryCompactor` | LLM summarizes messages older than N, keeps recent verbatim | 1 per trigger | Long conversations, multi-step reasoning |

### Storage backends

| Class | Persistence | Search | Dependencies |
|-------|------------|--------|--------------|
| `InMemoryStore` | Process lifetime only | Keyword (substring) | None |
| `SQLiteMemoryStore` | Local `.db` file | FTS5 full-text | `better-sqlite3` (~300 KB) |

### Usage examples

**In-session compaction only** (zero config, zero extra dependencies):

```typescript
import { ObservationMaskingCompactor } from "@omni-ai/memory";

const agent = new Agent(
  {
    ...agentConfig,
    memory: {
      compactor: new ObservationMaskingCompactor(),
      maxContextTokens: 60_000,   // trigger at 42k tokens (70%)
    },
  },
  provider,
  skills
);

const result = await agent.run({ input: "Analyse all files in src/" });
```

**Persistent memory across sessions** (SQLite):

```typescript
import { SQLiteMemoryStore, SummaryCompactor } from "@omni-ai/memory";

const store = new SQLiteMemoryStore({ path: "./sessions.db" });

const agent = new Agent(
  { ...agentConfig, memory: { store, compactor: new SummaryCompactor() } },
  provider,
  skills
);

// First run — session is stored automatically
await agent.run({
  input: "Review the auth module",
  session: { resourceId: "user-42", threadId: "review-2025-05-25" },
});

// Later run — agent loads previous messages as context
await agent.run({
  input: "What issues did you find last time?",
  session: { resourceId: "user-42", threadId: "review-2025-05-25" },
});

await store.close();
```

**Both together** (recommended for production):

```typescript
import { SQLiteMemoryStore, ObservationMaskingCompactor } from "@omni-ai/memory";

const memory = {
  store: new SQLiteMemoryStore({ path: "./sessions.db" }),
  compactor: new ObservationMaskingCompactor(),
  maxContextTokens: 80_000,
  lastMessages: 8,
};
```

### Memory interfaces (for custom backends)

Implement `IMemoryStore` from `@omni-ai/core` to use any storage backend:

```typescript
import type { IMemoryStore, SessionId, MemoryEntry } from "@omni-ai/core";

export class RedisMemoryStore implements IMemoryStore {
  async saveMessages(session: SessionId, messages: MemoryEntry[]) { ... }
  async loadMessages(session: SessionId, limit?: number) { ... }
  async search?(session: SessionId, query: string) { ... }
}
```

---

## Extending

### Create a custom provider

Implement `IProvider` from `@omni-ai/core`:

```typescript
import type { IProvider, ProviderCapabilities, CompletionRequest, CompletionResponse } from "@omni-ai/core";

export class MyProvider implements IProvider {
  readonly name = "my-provider";
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: false,
    streaming: true,
    toolUse: true,
    vision: false,
  };

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await callMyApi(request);
    return {
      content: response.text,
      toolCalls: response.tool_calls,
      usage: { inputTokens: response.usage.in, outputTokens: response.usage.out },
      model: request.model ?? "my-model",
      provider: this.name,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<string> {
    for await (const chunk of streamMyApi(request)) yield chunk.text;
  }
}
```

### Create a custom skill

Copy `skills/_template/skill.ts` and implement `ISkill`:

```typescript
import type { ISkill, SkillContext } from "@omni-ai/core";

interface Input { query: string; }
interface Output { results: string[]; }

export const mySearchSkill: ISkill<Input, Output> = {
  name: "my-search",
  description: "Search an external database for relevant records",

  async execute({ query }: Input, ctx: SkillContext): Promise<Output> {
    const results = await fetchExternalApi(query);
    return { results };
  },
};
```

### Create a custom agent

Copy `agents/_template/agent.yaml`:

```yaml
name: my-agent
description: What this agent does
# provider: my-provider   # optional — inherits defaultProvider from omni-ai.yaml
# model: my-model         # optional — inherits defaultModel from the provider config
systemPrompt: |
  You are a specialized assistant for...
  Describe constraints, output format, and behavior.
skills:
  - read-file
  - my-search
maxIterations: 10
temperature: 0.3
```

---

## TypeScript interfaces

Key types from `@omni-ai/core`:

```typescript
interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  stream?(request: CompletionRequest): AsyncGenerator<string>;
}

interface ISkill<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput, ctx: SkillContext): Promise<TOutput>;
}

interface IAgent {
  readonly config: AgentConfig;
  run(options: AgentRunOptions): Promise<AgentRunResult>;
}

interface AgentConfig {
  name: string;
  description: string;
  provider?: string;        // optional — inherits from config defaultProvider
  model?: string;           // optional — inherits from provider defaultModel
  systemPrompt: string;
  skills?: string[];
  maxIterations?: number;   // default: 10
  temperature?: number;
}
```

---

## Requirements

| Tool | Minimum version |
|------|----------------|
| Node.js | 20.x |
| pnpm | 9.x |
| TypeScript | 5.7 |

---

## Roadmap

- [x] `@omni-ai/core` — interfaces, registry, config schema (Zod)
- [x] `@omni-ai/skills-fs` — read-file, write-file, list-directory
- [x] `@omni-ai/skills-code` — search-code (ripgrep)
- [x] `@omni-ai/skills-ux` — audit-accessibility
- [x] Backend agents — schema, service, resolver, listener, test, atom-app, dev (7)
- [x] Frontend agents — ui-component, module-component, page-route, custom-hook, dev (5)
- [x] UX agents — reviewer, states, forms, motion, lead (5)
- [x] QA agents — qa-frontend, qa-ux, qa-backend, qa-lead (4)
- [x] Provider/model inheritance — agents inherit from config defaults
- [x] `@omni-ai/memory` — session memory + compaction (InMemoryStore, SQLiteMemoryStore, ObservationMaskingCompactor, SummaryCompactor)
- [ ] `@omni-ai/provider-anthropic` — production Anthropic adapter
- [ ] `@omni-ai/provider-openai` — production OpenAI adapter
- [ ] `@omni-ai/provider-copilot` — production GitHub Copilot adapter
- [ ] `@omni-ai/cli` — `omni run <agent> "<prompt>"` CLI
- [ ] Agent chaining — pipe output of one agent as input to another
- [ ] Streaming support — real-time token streaming to stdout

---

## License

MIT
