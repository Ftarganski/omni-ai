# CLAUDE.md — omni-ai

Project-level instructions for Claude Code. Read this before working on any task.

## What this project is

**omni-ai** is a provider-agnostic AI agents and skills framework for TypeScript monorepos.  
It provides `IProvider`, `ISkill`, and `IAgent` interfaces so that agents can be defined once in YAML and run against any configured LLM provider.

## Repository structure

```
packages/core/          @omni-ai/core — interfaces, registry, Zod config schema
packages/skills-fs/     @omni-ai/skills-fs — read-file, write-file, list-directory
packages/skills-code/   @omni-ai/skills-code — search-code
packages/skills-ux/     @omni-ai/skills-ux — audit-accessibility
agents/backend/         NestJS backend agent definitions (7 agents)
agents/frontend/        React/TypeScript frontend agent definitions (5 agents)
agents/ux/              UX implementation agents (5 agents)
agents/qa/              QA validation agents (4 agents)
providers/              Provider setup guides (anthropic, openai, copilot)
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

## File locations for key types

- Core interfaces: [packages/core/src/types.ts](packages/core/src/types.ts)
- Config schema: [packages/core/src/config/schema.ts](packages/core/src/config/schema.ts)
- Config example: [config/omni-ai.example.yaml](config/omni-ai.example.yaml)
- Agent template: [agents/_template/agent.yaml](agents/_template/agent.yaml)
- Skill template: [skills/_template/skill.ts](skills/_template/skill.ts)

## Adding a new agent

1. Copy `agents/_template/agent.yaml` to `agents/<domain>/<domain>-<role>.yaml`
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
4. Add docs to `providers/<name>/README.md`
5. Add to `.env.example` with key format and link to obtain it
6. Add to the providers section in [README.md](README.md)
