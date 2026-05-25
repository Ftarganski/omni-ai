# CLAUDE.md — omni-ai

Project-level instructions for Claude Code. Read this before working on any task.

## What this project is

**omni-ai** is a provider-agnostic AI agents and skills framework for TypeScript monorepos.  
It provides `IProvider`, `ISkill`, and `IAgent` interfaces so that agents can be defined once in YAML and run against any configured LLM provider.

## Repository structure

```
packages/core/          @omni-ai/core — interfaces, registry, Zod config schema
packages/provider-*/    Provider adapters (anthropic, openai) — compiled npm packages
packages/skills-*/      Skill packages (fs, code, ux) — compiled npm packages
packages/memory/        @omni-ai/memory — session stores and compactors
packages/cli/           @omni-ai/cli — `omni` CLI binary
agents/backend/         NestJS backend agent definitions (7 agents)
agents/frontend/        React/TypeScript frontend agent definitions (5 agents)
agents/ux/              UX implementation agents (5 agents)
agents/qa/              QA validation agents (4 agents)
docs/providers/         Provider setup guides (anthropic.md, openai.md, copilot.md)
docs/templates/         Templates for new agents and skills
config/                 omni-ai.example.yaml — copy to omni-ai.yaml (gitignored)
```

## Common commands

```bash
pnpm install          # install all workspace dependencies
pnpm build            # build all packages
pnpm typecheck        # type-check all packages
pnpm test             # run all tests
git status            # check what changed
git push origin master
```

## Critical rules — always follow

### 1. Provider-agnostic — no company names
- NEVER reference specific companies or projects: not "droz", not "motopurismo", not "ftdevfront"
- Use `@workspace/toolkit`, `@workspace/helpers`, `@workspace/testing` (generic placeholders)
- Use `@this/*` for local imports within a package — never `../../`
- Agent descriptions must be generic: "NestJS monorepo" not "the droz NestJS monorepo"

### 2. Agent YAML conventions
- `provider` and `model` are optional — agents inherit from `config/omni-ai.yaml` defaults
- Never hardcode `provider: anthropic` or `model: claude-sonnet-4-6` in agent files
- Agent names follow the pattern: `backend-*`, `frontend-*`, `ux-*`, `qa-*`
- File names match the agent name: `backend-dev.yaml` → `name: backend-dev`

### 3. Naming conventions (agents reference these)
- `TableService` / `TableModel<T>` / `TableEvent<T>` — DynamoDB ORM wrapper (NOT Bigtable*)
- `ARN` / `Arns` / `arn:` prefix — Atom Resource Names (NOT DRN/Drns/drn:)
- `Atom*` — conversational framework classes (NOT Nucleus*)
- `@workspace/atom` — conversational framework package (NOT @workspace/nucleus)

### 4. No sensitive data in commits
- `config/omni-ai.yaml` is gitignored — never commit the runtime config
- `.env` is gitignored — never commit API keys
- Use `.env.example` for documentation; never put real values there

### 5. TypeScript
- `provider` is optional in `AgentConfig` — do not make it required again
- `AgentConfigSchema.provider` is `z.string().optional()` — do not revert to required

## Memory system

`@omni-ai/memory` (`packages/memory/`) is the session memory and compaction package.

Key rules:
- `IMemoryStore`, `ICompactor`, `SessionId`, `MemoryEntry` live in `@omni-ai/core` — no circular deps
- `Agent.run()` accepts `session?: SessionId`; memory is opt-in and fully backward-compatible
- `newMessages` tracking: agent saves only messages from the current run, not the loaded history
- `ObservationMaskingCompactor` — zero LLM cost, masks old tool results; always safe to use
- `SummaryCompactor` — 1 LLM call per trigger; uses the agent's own `IProvider`, no extra API key
- `SQLiteMemoryStore` uses `better-sqlite3` (sync API, WAL mode, FTS5 full-text search)
- `InMemoryStore` is the default when no store is configured — process-lifetime only

## File locations for key types

- Core interfaces: [packages/core/src/types.ts](packages/core/src/types.ts)
- Config schema: [packages/core/src/config/schema.ts](packages/core/src/config/schema.ts)
- Agent loop: [packages/core/src/agents/agent.ts](packages/core/src/agents/agent.ts)
- Memory stores: [packages/memory/src/stores/](packages/memory/src/stores/)
- Compactors: [packages/memory/src/compactors/](packages/memory/src/compactors/)
- Config example: [config/omni-ai.example.yaml](config/omni-ai.example.yaml)
- Agent template: [docs/templates/agent.yaml](docs/templates/agent.yaml)
- Skill template: [docs/templates/skill.ts](docs/templates/skill.ts)

## Adding a new agent

1. Copy `docs/templates/agent.yaml` to `agents/<domain>/<domain>-<role>.yaml`
2. Set `name:` to match the filename (without `.yaml`)
3. Do NOT set `provider:` or `model:` — inherit from config
4. Add to the agent catalog in [README.md](README.md)

## Adding a new skill package

1. Create `packages/skills-<name>/` with `package.json`, `tsconfig.json`, `src/index.ts`
2. Implement `ISkill<TInput, TOutput>` from `@omni-ai/core`
3. Add the skill to the skills table in [README.md](README.md)

## Adding a new provider adapter

1. Create `packages/provider-<name>/` 
2. Implement `IProvider` from `@omni-ai/core`
3. Register it in `ProviderRegistry`
4. Add docs to `docs/providers/<name>.md`
5. Add to `.env.example` with key format and link to obtain it
6. Add to the providers section in [README.md](README.md)
