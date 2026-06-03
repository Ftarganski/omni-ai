<div align="center">
  <img src="https://raw.githubusercontent.com/Ftarganski/omni-ai/main/docs/images/logo.png" alt="omni-ai" width="140" />

  # omni-ai

  **Provider-agnostic AI agents and skills framework for TypeScript monorepos.**

  Configure any LLM provider — Anthropic, OpenAI, GitHub Copilot, Google Gemini, Groq, Ollama, or any self-hosted endpoint — and compose reusable agents for your projects via CLI or programmatic API.

  [![npm](https://img.shields.io/npm/v/@ftarganski/omni-ai?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ftarganski/omni-ai)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ftarganski/omni-ai/blob/main/LICENSE)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen?logo=node.js)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)](https://www.typescriptlang.org)
</div>

<br />

<div align="center">
  <img src="https://raw.githubusercontent.com/Ftarganski/omni-ai/main/docs/images/banner.png" alt="omni-ai — run AI agents for backend, frontend, UX and QA" width="100%" />
</div>

---

## Why omni-ai

- **Provider-agnostic** — swap LLM providers with one line in your config, no code changes
- **21 ready-made agents** — backend (NestJS), frontend (React), UX audit, QA validation
- **Composable skills** — 20+ tools (filesystem, git, HTTP, accessibility audit, image analysis) that agents call as needed
- **Session memory** — SQLite-backed persistent sessions with semantic search and token compaction
- **Extensible** — define custom agents in YAML, skills in TypeScript, providers via `IProvider`
- **MCP-compatible** — expose skills as MCP tools or consume any MCP server as skills

---

## How It Works

```
cd my-project
omni run backend-dev "create the orders module with CRUD and GraphQL"
         │
         ▼
    CLI (omni)
     │  reads config/omni-ai.yaml     ← provider, model, agentsDir
     │  resolves "backend-dev"        ← finds agents/**/*.yaml by name:
     │  instantiates the provider     ← AnthropicProvider / OpenAIProvider
     │  builds the SkillRegistry      ← read-file, write-file, search-code…
     │  creates the Agent → agent.run()
     │
     └─ Agentic loop:
          1. Sends systemPrompt + input to the LLM
          2. LLM returns text or tool calls
          3. Skills execute (read/write files in my-project/)
          4. Results return to the LLM
          5. Repeats until done or maxIterations reached
```

Skills always operate within **the directory where you run the command** (`process.cwd()`), never outside it.

---

## Quick Start

### 1. Install

```bash
npm install -g @ftarganski/omni-ai
```

### 2. Configure (interactive wizard)

```bash
omni init
```

The wizard asks for your provider and API key, then generates `config/omni-ai.yaml` and `.env`.

**Or configure manually:**

```bash
cp config/omni-ai.example.yaml config/omni-ai.yaml
cp .env.example .env
# edit both files with your provider and key
```

### 3. Run your first agent

```bash
# enter your project directory
cd /path/to/my-project

# list available agents
omni list agents

# run an agent
omni run backend-dev "create the orders module with CRUD"

# chain agents in a pipeline
omni chain "create orders module" backend-schema backend-dev qa-backend
```

---

## Providers

### Supported Providers

| Provider | Type | Key Required | Notes |
|----------|------|-------------|-------|
| GitHub Copilot | `copilot` | GitHub token | No separate account needed |
| Anthropic (Claude) | `anthropic` | Anthropic API key | Claude Opus, Sonnet, Haiku |
| OpenAI (GPT) | `openai` | OpenAI API key | GPT-4o, o1, o3-mini |
| Google Gemini | `google` | Google API key | Gemini 2.0 Flash, 1.5 Pro |
| Groq | `groq` | Groq API key | Llama, DeepSeek (free tier) |
| Ollama | `ollama` | None | Local models, no API key |
| Custom / Azure | `custom` | Varies | Any OpenAI-compatible endpoint |

### Configuration Examples

**GitHub Copilot** (recommended if you already have a GitHub subscription):

```bash
# .env
GITHUB_TOKEN=ghp_...
```

```yaml
# config/omni-ai.yaml
defaultProvider: copilot
providers:
  - name: copilot
    type: copilot
    apiKey: ${GITHUB_TOKEN}
    baseUrl: https://api.githubcopilot.com
    defaultModel: gpt-4o
```

**Anthropic (Claude):**

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

```yaml
defaultProvider: anthropic
providers:
  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-sonnet-4-6
```

**Multiple providers** (each agent can use a different one):

```yaml
defaultProvider: copilot
providers:
  - name: copilot
    type: copilot
    apiKey: ${GITHUB_TOKEN}
    defaultModel: gpt-4o

  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-sonnet-4-6

  - name: ollama
    type: ollama          # no API key required
    defaultModel: llama3.2
```

In any agent YAML, add `provider: anthropic` to override the default for that agent only.

---

## CLI Reference

### `omni run` — Run a single agent

```bash
omni run <agent> "<prompt>" [options]
```

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to `omni-ai.yaml` (auto-detected by default) |
| `--session <id>` | Session ID `"resourceId:threadId"` — enables SQLite memory across runs |
| `--output <file>` | Save output to a file |
| `--verbose` | Show each iteration, tool calls, and token count |
| `--stream` | Stream tokens in real time |

```bash
omni run backend-dev "create the customers module with CRUD and GraphQL"
omni run frontend-dev "create the orders listing page with filters and pagination"
omni run ux-lead "audit the OrderForm component"
omni run qa-lead "validate all files in src/orders/"
omni run backend-dev "what did you implement in the last session?" --session dev1:orders
```

---

### `omni chain` — Pipeline multiple agents

```bash
omni chain "<prompt>" <agent1> <agent2> [agent3...]
```

The output of each agent becomes the input of the next.

```bash
# Schema → implementation → validation
omni chain "create orders module" backend-schema backend-dev qa-backend

# Component generation + UX audit
omni chain "create orders listing page" frontend-dev ux-reviewer

# With output saved to file
omni chain "create customers module" backend-schema backend-dev qa-backend --output customers.md
```

**Visual output:**

```
◆ backend-schema  [anthropic / claude-sonnet-4-6]
  ... (3 iterations)

  ↓  output passed to: backend-dev

◆ backend-dev  [anthropic / claude-sonnet-4-6]
  ... (8 iterations)

  ↓  output passed to: qa-backend

◆ qa-backend  [anthropic / claude-sonnet-4-6]
  ... (4 iterations)

Tokens: 18,400 input · 5,200 output · ~$0.084
```

---

### Other Commands

| Command | Description |
|---------|-------------|
| `omni list agents` | List all available agents with names and descriptions |
| `omni list skills` | List all registered skills |
| `omni list providers` | List registered providers and their types |
| `omni init` | Interactive wizard to generate `omni-ai.yaml` and `.env` |
| `omni serve [--port N]` | Start a local HTTP server (REST + SSE) to call agents via API |
| `omni watch <agent> "<prompt>"` | Re-run an agent automatically on file changes |
| `omni eval <agent> <dataset.json>` | Evaluate an agent against an `(input, expected)` dataset |
| `omni export <sessionId>` | Export session history as Markdown or JSON |
| `omni mcp serve` | Expose all registered skills as MCP tools over stdio |

---

## Built-in Agents (21)

### Backend — NestJS / TypeScript (7 agents)

| Agent | What it does |
|-------|-------------|
| `backend-dev` | Orchestrator — full NestJS feature: schema → service → resolver → listeners → tests |
| `backend-schema` | DynamoDB OneTable schema with `defineSchema()` |
| `backend-service` | NestJS service with CRUD, events, error helpers, caching |
| `backend-resolver` | GraphQL resolver with federation pattern + SDL |
| `backend-listener` | Event listeners with `@OnEventCatcher` |
| `backend-test` | Jest integration tests with real local DynamoDB |
| `backend-atom-app` | Atom framework connectors (sessions, ARNs, message routing) |

### Frontend — React / TypeScript (5 agents)

| Agent | What it does |
|-------|-------------|
| `frontend-dev` | Orchestrator — full React feature: route → components → hooks |
| `frontend-ui-component` | Primitive UI components (shadcn/ui style, CVA + Radix) |
| `frontend-module-component` | Feature components connected to data (TanStack Query) |
| `frontend-page-route` | TanStack Router pages with responsive layouts |
| `frontend-custom-hook` | Typed, SSR-safe custom React hooks |

### UX (5 agents)

| Agent | What it does |
|-------|-------------|
| `ux-lead` | Orchestrator — full UX audit across 10 dimensions, fixes critical issues |
| `ux-reviewer` | Detailed UX review with findings by severity (Critical / Moderate / Low) |
| `ux-states` | State components: Skeleton, Empty, Error, Success |
| `ux-forms` | Forms with validation, autocomplete, accessibility, loading states |
| `ux-motion` | Micro-interactions and transitions (always `motion-safe:`) |

### QA (4 agents)

| Agent | What it does |
|-------|-------------|
| `qa-lead` | Orchestrator — classifies files, delegates to specialists, emits merge verdict |
| `qa-frontend` | Validates React/TypeScript: imports, Tailwind tokens, responsiveness, a11y |
| `qa-ux` | Validates UX: feedback states, forms, motion, content tone |
| `qa-backend` | Validates NestJS: services, resolvers, GraphQL schema, listeners, tests |

---

## Skills Library

Skills are the tools agents call during the agentic loop. All operate within `cwd` — never outside the target project.

| Category | Subpath | Skills |
|----------|---------|--------|
| Filesystem | `/skills/fs` | `read-file`, `write-file`, `list-directory` |
| Code | `/skills/code` | `search-code` (text/regex across TypeScript files) |
| UX | `/skills/ux` | `audit-accessibility` (heuristic a11y scan of TSX) |
| Git | `/skills/git` | `git-status`, `git-diff`, `git-log`, `git-commit-message` |
| HTTP | `/skills/http` | `http-request` (Bearer, Basic, OAuth2 client-credentials) |
| Multimodal | `/skills/multimodal` | `analyze-image` (screenshots, diagrams, mockups) |
| Backend | `/skills/backend` | `find-code-pattern`, `analyze-nestjs-module`, `analyze-dynamo-schema`, `analyze-graphql-schema` |
| Frontend | `/skills/frontend` | `find-component-pattern`, `analyze-component`, `analyze-module-structure` |
| QA | `/skills/qa` | `find-test-pattern`, `analyze-test-coverage` |

---

## Memory & Sessions

### Via CLI

```bash
# First run — session is created and stored in ~/.omni-ai/sessions.db
omni run backend-dev "create the orders module with CRUD" --session dev1:orders

# Second run — agent loads session history as context
omni run backend-dev "add the search listener to the orders module" --session dev1:orders

# Query previous context
omni run backend-dev "which files did you create in the last session?" --session dev1:orders
```

Session ID format: `"resourceId:threadId"`. Use `resourceId` for user/project and `threadId` for the feature or conversation.

### Via Programmatic API

```typescript
import { createRuntime } from "@ftarganski/omni-ai";
import { SQLiteMemoryStore, ObservationMaskingCompactor } from "@ftarganski/omni-ai/memory";

const runtime = await createRuntime({ skills: [] });

// Simple run, no memory
const result = await runtime.run("backend-dev", "create the customers module");
console.log(result.output);

// With cross-session persistence
const store = new SQLiteMemoryStore({ path: "./sessions.db" });

const result2 = await runtime.run(
  "backend-dev",
  "add search to the customers module",
  {
    session: { resourceId: "user-42", threadId: "feature-customers" },
    memoryStore: store,
  }
);
```

### Token Compaction

Without compaction, each iteration re-sends the full history:

```
Iteration 1:  1,000 tokens
Iteration 2:  3,500 tokens
Iteration 3:  8,200 tokens    → Total: 26,700 tokens
Iteration 4: 14,000 tokens
```

With `ObservationMaskingCompactor` (zero LLM cost):

```
Iteration 1:  1,000 tokens
Iteration 2:  3,500 tokens
Iteration 3:  1,800 tokens    ← old tool results masked
Iteration 4:  2,100 tokens    → Total: 8,400 tokens  (68% reduction)
```

| Compactor | Strategy | LLM calls | Best for |
|-----------|----------|-----------|----------|
| `ObservationMaskingCompactor` | Replaces old tool result bodies with `[masked ~N tokens]` | 0 | File-intensive agents |
| `SummaryCompactor` | LLM summarizes old messages, keeps N recent verbatim | 1 per trigger | Long conversations, multi-step reasoning |

---

## Programmatic API

```typescript
import { createRuntime, parallel } from "@ftarganski/omni-ai";
import { readFileSkill, writeFileSkill } from "@ftarganski/omni-ai/skills/fs";
import { searchCodeSkill } from "@ftarganski/omni-ai/skills/code";

const runtime = await createRuntime({
  skills: [readFileSkill, writeFileSkill, searchCodeSkill],
});

// Single agent run
const result = await runtime.run("backend-dev", "create the invoices module");
console.log(`Done in ${result.iterations} iterations`);
console.log(result.output);

// Run multiple agents in parallel
const outcome = await parallel(runtime, {
  agents: ["backend-dev", "qa-backend", "ux-reviewer"],
  input: "review the orders module for quality, tests, and accessibility",
});

for (const [agent, res] of Object.entries(outcome.results)) {
  if ("error" in res) console.error(`${agent}: ${res.error}`);
  else console.log(`${agent} (${res.iterations} iterations):\n${res.output}`);
}
```

---

## Extending the Framework

### Custom Agent (YAML, no rebuild needed)

```yaml
# agents/my-domain/my-agent.yaml
name: my-agent
description: What this agent does in one line
# provider: anthropic   # optional — inherits defaultProvider
# model: gpt-4o-mini    # optional — inherits defaultModel
systemPrompt: |
  You are a specialist in...
  Describe constraints, output format, and behavior.
skills:
  - read-file
  - search-code
  - write-file
maxIterations: 10
temperature: 0.2
```

Available immediately via `omni run my-agent "..."` — no rebuild required.

### Custom Skill (TypeScript)

```typescript
import type { ISkill } from "@ftarganski/omni-ai";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().describe("Search term"),
});

export const myDatabaseSkill: ISkill<z.infer<typeof InputSchema>, string[]> = {
  name: "search-database",
  description: "Searches records in an external database",

  async execute(input) {
    const { query } = InputSchema.parse(input);
    return await fetchFromExternalApi(query);
  },
};

// Register when creating the runtime
const runtime = await createRuntime({ skills: [myDatabaseSkill] });
```

### Custom Provider

```typescript
import type { IProvider, CompletionRequest, CompletionResponse } from "@ftarganski/omni-ai";
import { registerProvider } from "@ftarganski/omni-ai";

class MyProvider implements IProvider {
  readonly name: string;
  readonly capabilities = {
    chat: true, embedding: false, streaming: false, toolUse: true, vision: false,
  };

  constructor(private readonly config: { apiKey: string; name: string }) {
    this.name = config.name;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await callMyApi(request);
    return {
      content: response.text,
      toolCalls: [],
      usage: { inputTokens: response.in, outputTokens: response.out },
      model: request.model ?? "my-model",
      provider: this.name,
    };
  }
}

registerProvider("my-provider", (config) => new MyProvider(config));
```

```yaml
# config/omni-ai.yaml
providers:
  - name: my-provider
    type: my-provider
    apiKey: ${MY_API_KEY}
    defaultModel: my-model-v1
```

---

## Advanced

### Skill Middleware

Configurable interception around every skill call — logging, rate-limiting, caching, auditing.

```typescript
import type { SkillMiddlewareFn } from "@ftarganski/omni-ai";

const loggingMiddleware: SkillMiddlewareFn = async (name, input, ctx, next) => {
  console.time(`skill:${name}`);
  const result = await next();
  console.timeEnd(`skill:${name}`);
  return result;
};

const result = await runtime.run("backend-dev", "review src/", {
  middleware: [loggingMiddleware],
});
```

### MCP Integration

**Expose skills as MCP tools:**

```typescript
import { createMcpServer } from "@ftarganski/omni-ai/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSkill, writeFileSkill } from "@ftarganski/omni-ai/skills/fs";

const server = createMcpServer([readFileSkill, writeFileSkill], { name: "omni-ai" });
await server.connect(new StdioServerTransport());
```

**Or via CLI:**

```bash
omni mcp serve
```

**Claude Desktop integration (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "omni-ai": {
      "command": "omni",
      "args": ["mcp", "serve"]
    }
  }
}
```

**Consume an external MCP server as skills:**

```typescript
import { connectMcpSkills } from "@ftarganski/omni-ai/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "npx", args: ["-y", "@my/mcp-server"] });
const mcpSkills = await connectMcpSkills(transport);

const runtime = await createRuntime({ skills: mcpSkills });
```

---

## TypeScript Interfaces

```typescript
import type {
  IProvider, ISkill, IAgent, IMemoryStore,
  CompletionRequest, CompletionResponse,
  AgentConfig, AgentRunOptions, AgentRunResult,
  SessionId, SkillMiddlewareFn,
} from "@ftarganski/omni-ai";

interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

interface ISkill<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput, ctx: SkillContext): Promise<TOutput>;
}

interface AgentConfig {
  name: string;
  description: string;
  provider?: string;        // optional — inherits defaultProvider
  model?: string;           // optional — inherits defaultModel
  systemPrompt: string;
  skills?: string[];
  maxIterations?: number;   // default: 10
  temperature?: number;
  middleware?: SkillMiddlewareFn[];
}

interface AgentRunOptions {
  input: string;
  context?: Record<string, unknown>;
  session?: SessionId;
  onToken?: (chunk: string) => void;  // enables real-time token streaming
}

interface AgentRunResult {
  output: string;
  iterations: number;
  usage?: { inputTokens: number; outputTokens: number };
}

interface SessionId {
  resourceId: string;  // stable identifier (e.g. user ID, workspace ID)
  threadId: string;    // conversation or feature identifier
}
```

---

## Package Exports

```
@ftarganski/omni-ai              ← core: Agent, Runtime, ISkill, IProvider…
@ftarganski/omni-ai/skills/fs    ← read-file, write-file, list-directory
@ftarganski/omni-ai/skills/code  ← search-code
@ftarganski/omni-ai/skills/ux    ← audit-accessibility
@ftarganski/omni-ai/skills/git   ← git-diff, git-log, git-status, git-commit-message
@ftarganski/omni-ai/skills/http  ← http-request
@ftarganski/omni-ai/skills/multimodal  ← analyze-image
@ftarganski/omni-ai/skills/backend    ← analyze-dynamo-schema, analyze-graphql-schema…
@ftarganski/omni-ai/skills/frontend   ← analyze-component, analyze-module-structure…
@ftarganski/omni-ai/skills/qa         ← analyze-test-coverage, find-test-pattern
@ftarganski/omni-ai/memory       ← SQLiteMemoryStore, SemanticMemoryStore, compactors, VectorIndex
@ftarganski/omni-ai/mcp          ← createMcpServer, connectMcpSkills
@ftarganski/omni-ai/provider-anthropic  ← AnthropicProvider
@ftarganski/omni-ai/provider-openai     ← OpenAIProvider (+ Copilot, Groq, Ollama)
@ftarganski/omni-ai/provider-google     ← GoogleProvider
bin: omni                               ← full CLI
```

---

## Troubleshooting

**`omni: command not found`**
The CLI is not globally linked. Run `npm install -g @ftarganski/omni-ai`.

**`Provider "anthropic" not found in config`**
`config/omni-ai.yaml` does not exist or does not declare the provider. Run `omni init`.

**`Error: ANTHROPIC_API_KEY is not set`**
The environment variable is not loaded. Verify `.env` exists and contains the key. The CLI loads `.env` automatically.

**`maxIterations exceeded`**
The agent hit the iteration limit without finishing. Increase `maxIterations` in the agent YAML or make the prompt more specific.

**High token consumption**
Use `ObservationMaskingCompactor` via the programmatic API. Reduces context by up to 70% for file-intensive agents.

**`Access denied: path resolves outside the working directory`**
The agent attempted to access a file outside `cwd`. Run the command from inside the target project directory.

**Build fails with `Cannot find module`**
A referenced package has not been built yet. Run `pnpm build` at the root.

---

## License

MIT — © [Francis Targanski](https://targanski.com)
