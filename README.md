# omni-ai

Framework agnóstico de agentes e skills de IA — configure qualquer provedor (Anthropic, OpenAI, GitHub Copilot, etc.) e componha agentes reutilizáveis para seus projetos.

## Estrutura

```
omni-ai/
├── packages/
│   └── core/              # Interfaces e abstrações centrais (@omni-ai/core)
├── providers/             # Documentação e guias por provedor
│   ├── anthropic/
│   ├── openai/
│   └── copilot/
├── agents/                # Definições de agentes (YAML)
│   └── _template/         # Template para novos agentes
├── skills/                # Skills reutilizáveis (TypeScript)
│   └── _template/         # Template para novas skills
├── config/
│   └── omni-ai.example.yaml  # Configuração de exemplo
└── templates/             # Templates adicionais
```

## Conceitos

| Conceito | Descrição |
|----------|-----------|
| **Provider** | Adaptador para uma API de IA (Anthropic, OpenAI, Copilot...) |
| **Skill** | Capacidade reutilizável que um agente pode executar (ler arquivo, buscar código...) |
| **Agent** | Combina um provider + system prompt + skills para uma tarefa específica |
| **Config** | YAML central que define providers disponíveis e agentes do projeto |

## Início rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar e editar configuração
cp config/omni-ai.example.yaml config/omni-ai.yaml

# 3. Configurar variáveis de ambiente
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# 4. Usar o core no seu projeto
import { Agent, createProvider } from "@omni-ai/core";
```

## Criando um Provider

Implemente a interface `IProvider` de `@omni-ai/core`:

```typescript
import type { IProvider, CompletionRequest, CompletionResponse } from "@omni-ai/core";

export class MyProvider implements IProvider {
  readonly name = "my-provider";
  readonly capabilities = { chat: true, embedding: false, streaming: false, toolUse: false, vision: false };

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // chama a API do provedor
  }
}
```

## Criando uma Skill

Copie `skills/_template/skill.ts` e implemente a interface `ISkill`:

```typescript
export const mySkill: ISkill<Input, Output> = {
  name: "my-skill",
  description: "...",
  async execute(input, ctx) { ... }
};
```

## Criando um Agente

Copie `agents/_template/agent.yaml` e ajuste as propriedades:

```yaml
name: code-reviewer
provider: anthropic
systemPrompt: |
  You are an expert code reviewer...
skills:
  - read-file
```

## Provedores suportados

| Provider | Status | Pacote |
|----------|--------|--------|
| Anthropic (Claude) | Planejado | `@omni-ai/provider-anthropic` |
| OpenAI (GPT) | Planejado | `@omni-ai/provider-openai` |
| GitHub Copilot | Planejado | `@omni-ai/provider-copilot` |

## Roadmap

- [ ] `@omni-ai/core` — interfaces e registry
- [ ] `@omni-ai/provider-anthropic` — provider Anthropic
- [ ] `@omni-ai/provider-openai` — provider OpenAI
- [ ] `@omni-ai/provider-copilot` — provider GitHub Copilot
- [ ] `@omni-ai/skills-fs` — skills de sistema de arquivos
- [ ] `@omni-ai/skills-code` — skills de análise de código
- [ ] `@omni-ai/cli` — CLI para rodar agentes via terminal
