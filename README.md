# omni-ai

**Framework provider-agnostic de AI agents e skills para monorepos TypeScript.**

Configure qualquer provider LLM (Anthropic, OpenAI, GitHub Copilot, ou self-hosted) e compose agentes reutilizáveis para seus projetos — geração de backend, componentes frontend, revisão UX, validação QA, e mais — tudo via CLI ou API programática.

---

## Como funciona

```
cd meu-projeto
omni run backend-dev "crie o módulo de pedidos com CRUD e GraphQL"
         │
         ▼
    CLI (omni)
     │  lê config/omni-ai.yaml    ← provider, modelo e agentsDir
     │  resolve "backend-dev"     ← busca agents/**/*.yaml por name:
     │  instancia o provider      ← AnthropicProvider / OpenAIProvider
     │  monta o SkillRegistry     ← read-file, write-file, search-code...
     │  cria o Agent → agent.run()
     │
     └─ Loop agentico:
          1. Envia systemPrompt + input para o LLM
          2. LLM retorna texto ou tool calls
          3. Skills são executadas (lê/escreve arquivos no meu-projeto/)
          4. Resultados voltam para o LLM
          5. Repete até concluir ou atingir maxIterations
```

As skills (`read-file`, `write-file`, `search-code`, etc.) operam sempre no **diretório onde você executou o comando** (`process.cwd()`). O config e os agents ficam no repositório `omni-ai`.

---

## Instalação

### Pré-requisitos

| Ferramenta | Versão mínima |
|------------|---------------|
| Node.js    | 20.x          |
| pnpm       | 9.x           |

### 1. Clonar e instalar

```bash
git clone https://github.com/Ftarganski/omni-ai.git
cd omni-ai
pnpm install
pnpm build
```

### 2. Configurar o provider

**Opção A — wizard interativo (recomendado):**

```bash
omni init
```

**Opção B — manual:**

```bash
cp config/omni-ai.example.yaml config/omni-ai.yaml
cp .env.example .env
```

Edite `config/omni-ai.yaml` e `.env` de acordo com o provider escolhido. Veja a seção [Providers](#providers) abaixo.

### 3. Disponibilizar o CLI globalmente

```bash
# Uma vez — registra o comando `omni` no sistema
pnpm --filter @omni-ai/cli link --global
```

Depois disso, `omni` funciona de qualquer diretório.

### 4. Testar a instalação

```bash
# A partir do próprio omni-ai (ou de qualquer projeto)
omni list agents
omni list providers
omni list skills
```

---

## Uso rápido

```bash
# Entrar no projeto alvo
cd /path/para/meu-projeto

# Rodar um agente
omni run backend-dev "crie o módulo de pedidos"

# Com sessão de memória (persiste entre runs)
omni run backend-dev "continue o módulo de pedidos" --session user1:feature1

# Modo verbose — mostra iterações e tokens por step
omni run qa-backend "valide src/orders/orders.service.ts" --verbose

# Salvar output em arquivo
omni run backend-dev "crie módulo de notificações" --output implementacao.md
```

---

## CLI — Referência completa

### `omni run`

```
omni run <agent> "<prompt>" [opções]
```

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `--config <path>` | string | Caminho para o `omni-ai.yaml` (padrão: detectado automaticamente) |
| `--session <id>` | string | ID de sessão no formato `"resourceId:threadId"` — habilita memória SQLite entre runs |
| `--output <file>` | string | Salva o output completo em um arquivo |
| `--verbose` | flag | Exibe cada iteração, tool calls e contagem de tokens por step |
| `--stream` | flag | Transmite tokens em tempo real enquanto o agente responde |

**Exemplos:**

```bash
# Backend — gera módulo completo
omni run backend-dev "crie o módulo de customers com CRUD, GraphQL e listeners"

# Frontend — gera componente
omni run frontend-dev "crie a página de listagem de pedidos com filtros e paginação"

# UX — audita e corrige problemas
omni run ux-lead "audite o componente OrderForm"

# QA — valida código gerado
omni run qa-lead "valide todos os arquivos em src/orders/"

# Com memória entre sessões
omni run backend-dev "o que você implementou no módulo de customers?" --session dev1:customers

# Agente específico + output em arquivo
omni run backend-schema "crie o schema para a entidade Invoice" --output invoice-schema.md
```

---

### `omni list`

```bash
omni list agents      # Lista todos os agentes disponíveis (nome + descrição)
omni list skills      # Lista todas as skills registradas
omni list providers   # Lista os providers registrados e seus tipos
```

---

### `omni chain`

Executa uma sequência de agentes em pipeline: a saída de cada agente se torna a entrada do próximo.

```
omni chain "<prompt>" <agent1> <agent2> [agent3...]
```

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `--config <path>` | string | Caminho para o `omni-ai.yaml` |
| `--output <file>` | string | Salva o output final em arquivo |
| `--verbose` | flag | Imprime o output de cada agente intermediário |
| `--stream` | flag | Transmite tokens em tempo real para cada agente da cadeia |

**Exemplos:**

```bash
# Schema → implementação → validação
omni chain "crie módulo de orders" backend-schema backend-dev qa-backend

# Geração de componente + auditoria UX
omni chain "crie a página de listagem de pedidos" frontend-dev ux-reviewer

# Com output salvo
omni chain "crie o módulo de customers" backend-schema backend-dev qa-backend --output customers.md

# Verbose — mostra output intermediário de cada agente
omni chain "crie módulo de invoices" backend-schema backend-dev --verbose

# Streaming em tempo real ao longo da cadeia
omni chain "crie e revise o módulo de orders" backend-dev qa-backend --stream
```

**Output visual:**

```
◆ backend-schema  [anthropic / claude-sonnet-4-6]
  ... (3 iterações)

  ↓  saída passada para: backend-dev

◆ backend-dev  [anthropic / claude-sonnet-4-6]
  ... (8 iterações)

  ↓  saída passada para: qa-backend

◆ qa-backend  [anthropic / claude-sonnet-4-6]
  ... (4 iterações)

<output final do qa-backend>

Tokens: 18.400 entrada · 5.200 saída · ~$0.084
```

---

### `omni init`

Wizard interativo que gera `config/omni-ai.yaml` e atualiza o `.env` sem editar arquivos manualmente.

```bash
omni init
```

O wizard irá:

1. Perguntar qual provider usar (Copilot, Anthropic, OpenAI ou Custom/self-hosted)
2. Solicitar a API key ou token via campo oculto (não aparece no terminal)
3. Permitir selecionar o modelo padrão
4. Opcionalmente configurar um segundo provider para agentes específicos
5. Gerar `config/omni-ai.yaml` e atualizar `.env` preservando entradas existentes
6. Exibir os próximos passos com exemplos de comandos

**Quando usar:** na primeira vez que configurar o omni-ai, ou quando quiser trocar ou adicionar um provider.

> Se `config/omni-ai.yaml` já existir, o wizard pergunta antes de sobrescrever.

---

## Providers

### GitHub Copilot (recomendado para usuários GitHub)

Não requer conta separada — usa o seu token GitHub existente.

```bash
# 1. Autenticar com GitHub CLI (se ainda não fez)
gh auth login

# 2. Obter o token
gh auth token
# Copia o valor e cola no .env abaixo
```

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

> **Nota:** Requer uma assinatura ativa do GitHub Copilot (Individual, Business ou Enterprise).

---

### Anthropic (Claude)

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

```yaml
# config/omni-ai.yaml
defaultProvider: anthropic

providers:
  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-sonnet-4-6
```

Como obter: [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key

**Modelos disponíveis:**

| Modelo | ID | Uso recomendado |
|--------|----|-----------------|
| Claude Opus 4.7 | `claude-opus-4-7` | Raciocínio complexo, contexto longo |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Qualidade/velocidade balanceados ✓ |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Tarefas rápidas e de baixo custo |

> **Atenção:** A API Anthropic requer `temperature <= 1.0`. O adapter valida isso automaticamente.

---

### OpenAI (GPT)

```bash
# .env
OPENAI_API_KEY=sk-proj-...
```

```yaml
# config/omni-ai.yaml
defaultProvider: openai

providers:
  - name: openai
    type: openai
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4o
```

Como obter: [platform.openai.com](https://platform.openai.com) → API keys

**Modelos disponíveis:**

| Modelo | ID | Uso recomendado |
|--------|----|-----------------|
| GPT-4o | `gpt-4o` | Multimodal, raciocínio forte |
| GPT-4o mini | `gpt-4o-mini` | Rápido, custo eficiente |
| o1 | `o1` | Raciocínio avançado |
| o3-mini | `o3-mini` | Raciocínio rápido |

---

### Custom / self-hosted (Ollama, Groq, Azure, vLLM...)

Qualquer endpoint compatível com a API OpenAI de chat completions:

```bash
# .env
CUSTOM_LLM_BASE_URL=http://localhost:11434/v1   # Ollama
CUSTOM_LLM_API_KEY=                              # Vazio para Ollama
```

```yaml
# config/omni-ai.yaml
providers:
  - name: ollama
    type: custom
    baseUrl: ${CUSTOM_LLM_BASE_URL}
    apiKey: ${CUSTOM_LLM_API_KEY}
    defaultModel: llama3.2
```

Endpoints compatíveis: **Ollama**, **LM Studio**, **vLLM**, **Groq**, **Together AI**, **Azure OpenAI**, **Mistral AI**, **Perplexity**.

---

### Múltiplos providers

Você pode declarar vários providers e cada agente pode usar um diferente:

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
    type: custom
    baseUrl: http://localhost:11434/v1
    defaultModel: llama3.2
```

No arquivo YAML do agente, basta declarar `provider: anthropic` para sobrescrever o padrão apenas para aquele agente.

---

## Configuração — referência completa

### `omni-ai.yaml`

```yaml
version: "1"

# Provider padrão para todos os agentes (a menos que o agente sobrescreva)
defaultProvider: copilot

# Diretório dos YAML de agentes (relativo à raiz do omni-ai)
agentsDir: agents

providers:
  - name: copilot
    type: copilot            # "anthropic" | "openai" | "copilot" | "custom"
    apiKey: ${GITHUB_TOKEN}  # referência a variável de ambiente — nunca hardcode
    baseUrl: https://api.githubcopilot.com
    defaultModel: gpt-4o     # modelo usado quando o agente não especifica

agents:
  # Agente inline — definido diretamente no config (não precisa de arquivo YAML separado)
  - name: code-reviewer
    description: Revisa código para qualidade, bugs e segurança
    systemPrompt: |
      Você é um revisor de código especialista...
    skills:
      - read-file
      - search-code
    maxIterations: 5

  # Agente com override de provider/modelo
  - name: doc-writer
    description: Gera documentação
    provider: anthropic       # sobrescreve defaultProvider só para este agente
    model: claude-haiku-4-5-20251001  # sobrescreve defaultModel
    systemPrompt: |
      Você é um redator técnico...
    maxIterations: 3
```

### Herança de provider e modelo

```
omni-ai.yaml
  └─ defaultProvider: copilot          ← se aplica a todos os agentes
       └─ providers[copilot]
            └─ defaultModel: gpt-4o   ← se aplica a todos os agentes

agents/backend/backend-dev.yaml
  ├─ provider: (ausente)  →  usa defaultProvider (copilot)
  ├─ provider: anthropic  →  sobrescreve só para este agente
  ├─ model: (ausente)     →  usa defaultModel do provider resolvido
  └─ model: gpt-4o-mini   →  sobrescreve só para este agente
```

### Campos do agente YAML

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `name` | `string` | obrigatório | Identificador único |
| `description` | `string` | obrigatório | O que o agente faz |
| `provider` | `string` | herda | Nome do provider — omita para usar `defaultProvider` |
| `model` | `string` | herda | ID do modelo — omita para usar `defaultModel` do provider |
| `systemPrompt` | `string` | obrigatório | Instruções do agente |
| `skills` | `string[]` | `[]` | Skills que o agente pode chamar como ferramentas |
| `maxIterations` | `number` | `10` | Máximo de iterações do loop agentico |
| `temperature` | `number` | padrão do provider | Temperatura de amostragem (0–2; max 1.0 para Anthropic) |

---

## Catálogo de agentes

### Backend (7 agentes)

| Agente | Arquivo | O que faz |
|--------|---------|-----------|
| `backend-dev` | `agents/backend/backend-dev.yaml` | Orquestrador — feature NestJS completa: schema → serviço → resolver → listeners → tests |
| `backend-schema` | `agents/backend/backend-schema.yaml` | Schema DynamoDB OneTable com `defineSchema()` |
| `backend-service` | `agents/backend/backend-service.yaml` | NestJS service com CRUD, eventos, error helpers, caching |
| `backend-resolver` | `agents/backend/backend-resolver.yaml` | GraphQL resolver com padrão federation + SDL |
| `backend-listener` | `agents/backend/backend-listener.yaml` | Event listeners com `@OnEventCatcher` |
| `backend-test` | `agents/backend/backend-test.yaml` | Testes Jest de integração com DynamoDB local real |
| `backend-atom-app` | `agents/backend/backend-atom-app.yaml` | Conectores Atom framework (sessões, ARNs, roteamento de mensagens) |

### Frontend (5 agentes)

| Agente | Arquivo | O que faz |
|--------|---------|-----------|
| `frontend-dev` | `agents/frontend/frontend-dev.yaml` | Orquestrador — feature React completa: route → componentes → hooks |
| `frontend-ui-component` | `agents/frontend/frontend-ui-component.yaml` | Componentes UI primitivos estilo shadcn/ui com CVA + Radix |
| `frontend-module-component` | `agents/frontend/frontend-module-component.yaml` | Componentes de feature conectados a dados (TanStack Query) |
| `frontend-page-route` | `agents/frontend/frontend-page-route.yaml` | Páginas TanStack Router com layouts responsivos |
| `frontend-custom-hook` | `agents/frontend/frontend-custom-hook.yaml` | Custom React hooks tipados e SSR-safe |

### UX (5 agentes)

| Agente | Arquivo | O que faz |
|--------|---------|-----------|
| `ux-lead` | `agents/ux/ux-lead.yaml` | Orquestrador — auditoria UX completa em 10 dimensões, corrige críticos e documenta os demais |
| `ux-reviewer` | `agents/ux/ux-reviewer.yaml` | Revisão UX detalhada com findings por severidade (Critical / Moderate / Low) |
| `ux-states` | `agents/ux/ux-states.yaml` | Componentes de estado: Skeleton, Empty, Error e Success |
| `ux-forms` | `agents/ux/ux-forms.yaml` | Formulários com validação, autocomplete, acessibilidade e estados de loading |
| `ux-motion` | `agents/ux/ux-motion.yaml` | Micro-interações e transições com `motion-safe:` obrigatório |

### QA (4 agentes)

| Agente | Arquivo | O que faz |
|--------|---------|-----------|
| `qa-lead` | `agents/qa/qa-lead.yaml` | Orquestrador — classifica arquivos, delega aos agentes especializados e emite veredicto de merge |
| `qa-frontend` | `agents/qa/qa-frontend.yaml` | Valida React/TypeScript: imports, tokens Tailwind, responsividade, acessibilidade |
| `qa-ux` | `agents/qa/qa-ux.yaml` | Valida UX: feedback states, formulários, motion, content tone |
| `qa-backend` | `agents/qa/qa-backend.yaml` | Valida NestJS: services, resolvers, schema GraphQL, listeners, testes |

---

## Skills disponíveis

As skills são as ferramentas que os agentes podem chamar durante o loop agentico. Todas operam dentro do `cwd` (diretório do projeto alvo) — nunca fora dele.

| Skill | Package | O que faz |
|-------|---------|-----------|
| `read-file` | `@omni-ai/skills-fs` | Lê o conteúdo completo de um arquivo |
| `write-file` | `@omni-ai/skills-fs` | Escreve ou sobrescreve um arquivo (cria diretórios automaticamente) |
| `list-directory` | `@omni-ai/skills-fs` | Lista arquivos em um diretório (com suporte a recursivo e filtro por extensão) |
| `search-code` | `@omni-ai/skills-code` | Busca texto ou regex em arquivos TypeScript/TSX |
| `audit-accessibility` | `@omni-ai/skills-ux` | Scan heurístico de a11y em componentes TSX (alt, aria-label, foco, cores hardcoded...) |

### Segurança das skills de filesystem

`read-file`, `write-file` e `list-directory` resolvem todos os caminhos relativos ao `cwd` e **rejeitam qualquer path que escape o diretório do projeto** (bloqueando ataques de path traversal como `../../../etc/passwd`).

---

## Memória e sessões

### Via CLI (--session)

```bash
# Primeira execução — sessão é criada e armazenada em ~/.omni-ai/sessions.db
omni run backend-dev "crie o módulo de pedidos com CRUD" --session dev1:orders

# Segunda execução — o agente carrega o histórico da sessão anterior como contexto
omni run backend-dev "adicione o listener de busca ao módulo de pedidos" --session dev1:orders

# Consulta de contexto anterior
omni run backend-dev "quais arquivos você criou na sessão anterior?" --session dev1:orders
```

O ID de sessão segue o formato `"resourceId:threadId"`. Use `resourceId` para identificar o usuário ou projeto, e `threadId` para a feature ou conversa específica.

### Via API programática

```typescript
import { createRuntime } from "@omni-ai/core";
import { SQLiteMemoryStore, ObservationMaskingCompactor } from "@omni-ai/memory";

const runtime = await createRuntime({
  skills: [/* suas skills extras */],
});

// Sem memória — execução simples
const result = await runtime.run("backend-dev", "crie o módulo de clientes");
console.log(result.output);

// Com memória entre sessões
const store = new SQLiteMemoryStore({ path: "./sessions.db" });

const result2 = await runtime.run(
  "backend-dev",
  "adicione busca ao módulo de clientes",
  {
    session: { resourceId: "user-42", threadId: "feature-customers" },
    memoryStore: store,
  }
);
```

### Compactors — redução de consumo de tokens

Sem compaction, cada iteração reencaminha todo o histórico:

```
Iteração 1:  1.000 tokens
Iteração 2:  3.500 tokens
Iteração 3:  8.200 tokens    → Total: 26.700 tokens
Iteração 4: 14.000 tokens
```

Com `ObservationMaskingCompactor`:

```
Iteração 1:  1.000 tokens
Iteração 2:  3.500 tokens
Iteração 3:  1.800 tokens    ← resultados antigos de tool mascarados
Iteração 4:  2.100 tokens    → Total: 8.400 tokens  (redução de 68%)
```

| Compactor | Estratégia | Chamadas LLM | Ideal para |
|-----------|-----------|--------------|-----------|
| `ObservationMaskingCompactor` | Substitui corpo de tool results antigos por `[masked ~N tokens]` | 0 | Agentes intensivos em leitura de arquivos |
| `SummaryCompactor` | LLM resume mensagens antigas, mantém N recentes verbatim | 1 por trigger | Conversas longas, raciocínio multi-step |

---

### Busca semântica com embeddings

`SemanticMemoryStore` substitui a busca por palavras-chave (FTS5) por similaridade de coseno usando embeddings do provider.

```typescript
import { createRuntime } from "@omni-ai/core";
import { SQLiteMemoryStore, SemanticMemoryStore } from "@omni-ai/memory";
import { OpenAIProvider } from "@omni-ai/provider-openai";

// Provider com suporte a embeddings (capabilities.embedding = true)
const embeddingProvider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! });

// Persiste mensagens no SQLite + busca semântica em memória
const store = new SemanticMemoryStore(
  embeddingProvider,
  new SQLiteMemoryStore({ path: "./sessions.db" })
);

const runtime = await createRuntime({ skills, memoryStore: store });
```

**Busca por similaridade:**

```typescript
const results = await store.search(
  { resourceId: "user1", threadId: "thread1" },
  "como foi implementado o módulo de orders?",
  5 // topK
);
// results: [{ content: "...", score: 0.91 }, ...]
```

**`VectorIndex`** — índice vetorial in-memory para uso direto:

```typescript
import { VectorIndex } from "@omni-ai/memory";

const index = new VectorIndex<string>();
index.add("doc1", embeddingVector1);
index.add("doc2", embeddingVector2);

const results = index.query(queryVector, 3); // [{ id: "doc1", score: 0.94 }, ...]
```

---

## Estrutura do repositório

```
omni-ai/
│
├── packages/                          # pacotes npm (pnpm workspaces)
│   ├── core/                          # @omni-ai/core
│   │   └── src/
│   │       ├── types.ts               # IProvider, ISkill, IAgent, IMemoryStore...
│   │       ├── config/
│   │       │   ├── schema.ts          # Zod schema do omni-ai.yaml
│   │       │   └── loader.ts          # loadConfig() com substituição de env vars
│   │       ├── agents/
│   │       │   ├── agent.ts           # Loop agentico + integração de memória
│   │       │   └── loader.ts          # loadAgent() — carrega YAML + resolve provider
│   │       ├── providers/registry.ts  # ProviderRegistry (factory por type string)
│   │       ├── skills/registry.ts     # SkillRegistry
│   │       └── bootstrap.ts           # createRuntime() — API de alto nível
│   │
│   ├── provider-anthropic/            # @omni-ai/provider-anthropic
│   │   └── src/
│   │       ├── provider.ts            # AnthropicProvider implements IProvider
│   │       ├── mappers.ts             # Conversão omni-ai ↔ Anthropic SDK types
│   │       └── index.ts              # Registra "anthropic" no ProviderRegistry
│   │
│   ├── provider-openai/               # @omni-ai/provider-openai
│   │   └── src/
│   │       ├── provider.ts            # OpenAIProvider implements IProvider
│   │       ├── mappers.ts             # Conversão omni-ai ↔ OpenAI SDK types
│   │       └── index.ts              # Registra "openai" e "copilot" no ProviderRegistry
│   │
│   ├── memory/                        # @omni-ai/memory
│   │   └── src/
│   │       ├── stores/
│   │       │   ├── in-memory.ts       # InMemoryStore (padrão, sem persistência)
│   │       │   ├── sqlite.ts          # SQLiteMemoryStore (arquivo local, FTS5)
│   │       │   └── semantic-memory-store.ts  # SemanticMemoryStore (busca por cosine similarity)
│   │       ├── compactors/
│   │       │   ├── observation-masking.ts  # Mascara tool results antigos (zero LLM)
│   │       │   └── summary.ts              # Resumo por LLM (1 chamada por trigger)
│   │       ├── vector.ts              # VectorIndex + cosineSimilarity
│   │       └── utils.ts               # estimateTokens() compartilhado
│   │
│   ├── skills-fs/                     # @omni-ai/skills-fs
│   │   └── src/
│   │       ├── read-file.ts           # Lê arquivo (com validação de path traversal)
│   │       ├── write-file.ts          # Escreve arquivo (com validação de path)
│   │       └── list-directory.ts      # Lista diretório (com validação de path)
│   │
│   ├── skills-code/                   # @omni-ai/skills-code
│   │   └── src/
│   │       └── search-code.ts         # Busca texto/regex em arquivos TypeScript
│   │
│   ├── skills-ux/                     # @omni-ai/skills-ux
│   │   └── src/
│   │       └── audit-accessibility.ts # Scan heurístico a11y de componentes TSX
│   │
│   └── cli/                           # @omni-ai/cli
│       └── src/
│           ├── bin.ts                 # Entry point, carrega .env
│           ├── commands/
│           │   ├── run.ts             # omni run <agent> "<prompt>"
│           │   ├── chain.ts           # omni chain "<prompt>" <agent1> <agent2>...
│           │   ├── list.ts            # omni list agents|skills|providers
│           │   └── init.ts            # omni init — wizard interativo
│           └── utils/
│               ├── format.ts          # Output formatado (tokens, iterações, erros)
│               └── config-path.ts     # Resolve caminho do omni-ai.yaml
│
├── agents/                            # Definições YAML dos agentes (21 agentes)
│   ├── backend/                       # 7 agentes NestJS/TypeScript
│   ├── frontend/                      # 5 agentes React/TypeScript
│   ├── ux/                            # 5 agentes UX
│   └── qa/                            # 4 agentes QA
│
├── docs/                              # Documentação
│   ├── providers/
│   │   ├── anthropic.md               # Setup detalhado Anthropic
│   │   ├── openai.md                  # Setup detalhado OpenAI
│   │   └── copilot.md                 # Setup detalhado GitHub Copilot
│   └── templates/
│       ├── agent.yaml                 # Template para novos agentes
│       └── skill.ts                   # Template para novas skills
│
├── config/
│   └── omni-ai.example.yaml           # Template de configuração (copie → omni-ai.yaml)
│
├── .env.example                       # Template de variáveis de ambiente
└── tsconfig.ide.json                  # Paths para resolução de tipos no VS Code
```

---

## Usando de outro projeto

O `omni-ai` é um repositório central — os agentes e o config ficam nele. Você usa o CLI de dentro de qualquer projeto alvo.

### Setup único (instalação global)

```bash
# Na raiz do omni-ai, uma vez só:
cd /caminho/para/omni-ai
pnpm --filter @omni-ai/cli link --global
```

### Uso do dia a dia

```bash
# 1. Entrar no projeto alvo
cd /caminho/para/meu-projeto

# 2. Rodar agentes normalmente
omni run backend-dev "crie o módulo de produtos"
omni run frontend-dev "crie a página de listagem de produtos"
omni run qa-lead "valide src/products/"
omni run ux-reviewer "audite src/components/modules/Products/"
```

As skills sempre operam em `/caminho/para/meu-projeto` — o agente lê, escreve e busca arquivos nesse diretório, nunca fora dele.

### Alternativa sem instalação global

```bash
# Usando node diretamente
node /caminho/para/omni-ai/packages/cli/dist/bin.js run backend-dev "..."

# Ou com alias no shell (~/.bashrc, ~/.zshrc ou $PROFILE no PowerShell)
alias omni="node /caminho/para/omni-ai/packages/cli/dist/bin.js"
```

---

## Estendendo o framework

### Criar um agente personalizado

Copie `docs/templates/agent.yaml` para `agents/<domínio>/<domínio>-<função>.yaml`:

```yaml
name: my-agent
description: O que este agente faz em uma linha
# provider: anthropic   # opcional — herda defaultProvider do omni-ai.yaml
# model: gpt-4o-mini    # opcional — herda defaultModel do provider
systemPrompt: |
  Você é um assistente especializado em...
  Descreva as restrições, formato de output e comportamento.
skills:
  - read-file
  - search-code
  - write-file
maxIterations: 10
temperature: 0.2
```

O arquivo estará disponível via `omni run my-agent "..."` imediatamente — sem rebuild.

### Criar uma skill personalizada

Copie `docs/templates/skill.ts` e implemente `ISkill`:

```typescript
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().describe("Termo a buscar"),
});

type Input = z.infer<typeof InputSchema>;

export const myDatabaseSkill: ISkill<Input, string[]> = {
  name: "search-database",
  description: "Busca registros no banco de dados externo",

  async execute(input: Input): Promise<string[]> {
    const { query } = InputSchema.parse(input);
    // sua lógica aqui
    return await fetchFromExternalApi(query);
  },
};
```

Registre a skill ao criar o runtime:

```typescript
import { createRuntime } from "@omni-ai/core";
import { myDatabaseSkill } from "./my-database-skill.js";

const runtime = await createRuntime({
  skills: [myDatabaseSkill],
});
```

Ou passe diretamente no CLI customizando o `run.ts`.

### Criar um provider personalizado

Implemente `IProvider` de `@omni-ai/core`:

```typescript
import type { IProvider, CompletionRequest, CompletionResponse } from "@omni-ai/core";
import { registerProvider } from "@omni-ai/core";

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

// Registrar o type string para o omni-ai.yaml
registerProvider("my-provider", (config) => new MyProvider(config));
```

Adicione o `docs/providers/<nome>.md` e declare no `omni-ai.yaml`:

```yaml
providers:
  - name: my-provider
    type: my-provider
    apiKey: ${MY_API_KEY}
    defaultModel: my-model-v1
```

---

## Interfaces TypeScript principais

```typescript
// @omni-ai/core

interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;  // requer capabilities.embedding = true
}

interface ProviderCapabilities {
  chat: boolean;
  embedding: boolean;
  streaming: boolean;   // suporte a onToken em CompletionRequest
  toolUse: boolean;
  vision: boolean;
}

interface CompletionRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  onToken?: (chunk: string) => void;  // habilita streaming chunk a chunk
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
  provider?: string;        // opcional — herda defaultProvider
  model?: string;           // opcional — herda defaultModel do provider
  systemPrompt: string;
  skills?: string[];
  maxIterations?: number;   // padrão: 10
  temperature?: number;
  memory?: MemoryConfig;
}

interface AgentRunOptions {
  input: string;
  context?: Record<string, unknown>;
  session?: SessionId;                // habilita persistência de memória
  onToken?: (chunk: string) => void;  // habilita streaming de tokens em tempo real
}

interface AgentRunResult {
  output: string;
  iterations: number;
  usage?: { inputTokens: number; outputTokens: number };
}

interface SessionId {
  resourceId: string;  // identificador estável (ex: user ID, workspace ID)
  threadId: string;    // identificador da conversa ou feature
}
```

---

## Arquitetura de pacotes

```
@omni-ai/cli
  ├── @omni-ai/core          ← interfaces, registry, bootstrap, config
  ├── @omni-ai/memory        ← stores, compactors, vector index
  ├── @omni-ai/provider-anthropic
  ├── @omni-ai/provider-openai
  ├── @omni-ai/skills-fs
  ├── @omni-ai/skills-code
  └── @omni-ai/skills-ux

@omni-ai/memory              → @omni-ai/core
@omni-ai/provider-anthropic  → @omni-ai/core
@omni-ai/provider-openai     → @omni-ai/core
@omni-ai/skills-fs           → @omni-ai/core
@omni-ai/skills-code         → @omni-ai/core
@omni-ai/skills-ux           → @omni-ai/core
```

`@omni-ai/core` não tem dependências internas — é a base estável do framework. Todos os outros pacotes dependem apenas dele, sem dependências cruzadas entre si.

---

## Comandos de desenvolvimento

```bash
# Instalar dependências
pnpm install

# Build de todos os pacotes
pnpm build

# Type-check sem build
pnpm typecheck

# Lint em todos os pacotes
pnpm lint

# Rodar testes
pnpm test

# Build de um pacote específico
pnpm --filter @omni-ai/core build

# Reconstruir e testar o CLI
pnpm build && omni list agents
```

---

## Roadmap

### Concluído

- [x] `@omni-ai/core` — interfaces, ProviderRegistry, SkillRegistry, config schema (Zod)
- [x] `@omni-ai/provider-anthropic` — adapter completo com mapeamento de tipos e tool use
- [x] `@omni-ai/provider-openai` — adapter completo (cobre OpenAI, Copilot, Groq, Ollama, Azure)
- [x] `@omni-ai/skills-fs` — read-file, write-file, list-directory (com proteção path traversal)
- [x] `@omni-ai/skills-code` — search-code (regex, filtro por extensão, maxResults)
- [x] `@omni-ai/skills-ux` — audit-accessibility (scan heurístico TSX)
- [x] `@omni-ai/memory` — InMemoryStore, SQLiteMemoryStore, SemanticMemoryStore, VectorIndex, ObservationMaskingCompactor, SummaryCompactor
- [x] `@omni-ai/cli` — `omni run`, `omni list`, `omni chain`, `omni init`, `--session`, `--verbose`, `--stream`, `--output`
- [x] Bootstrap `createRuntime()` — API de alto nível para uso programático
- [x] 21 agentes prontos — backend (7), frontend (5), ux (5), qa (4)
- [x] Herança de provider/modelo — agentes herdam do config, podem sobrescrever
- [x] Agentes inline — definição direta no `omni-ai.yaml` sem arquivo YAML separado
- [x] Streaming de tokens em tempo real (`omni run ... --stream`, `omni chain ... --stream`)
- [x] Encadeamento de agentes — output de um agente como input de outro (`omni chain`)
- [x] `omni init` — wizard interativo para configuração inicial
- [x] Suporte a embeddings — `IProvider.embed()` com vetores de contexto (`SemanticMemoryStore`, `VectorIndex`)
- [x] Testes automatizados por pacote — 63 testes, 8 pacotes (vitest)
- [x] ESLint + typescript-eslint — linting automático em todos os pacotes (`pnpm lint`)

### Próximos passos

**CLI & DX**
- [ ] `omni new` — scaffold interativo para criar agente, skill ou provider a partir de template
- [ ] `omni eval` — avaliação em lote: roda agente contra dataset de `(input, expected)` e reporta acurácia
- [ ] `omni serve` — inicia servidor HTTP local para chamar agentes via REST ou SSE (sem CLI)
- [ ] `omni watch` — reexecuta agente automaticamente quando arquivos do projeto mudam (modo dev)
- [ ] `omni export` — exporta histórico de sessão em markdown ou JSON

**Providers & resiliência**
- [ ] `@omni-ai/provider-google` — adapter para Gemini 1.5 / 2.0 (chat, vision, embeddings)
- [ ] Retry automático com backoff exponencial — recuperação transparente de rate-limit e erros 5xx
- [ ] Fallback de provider — rota pedidos para um provider secundário quando o primário falha

**Skills**
- [ ] `@omni-ai/skills-git` — git status, diff, log, commit message (para agentes de review e release)
- [ ] `@omni-ai/skills-http` — chamadas HTTP autenticadas (OAuth/Bearer) para integrar APIs externas
- [ ] Suporte multimodal — skill `analyze-image` para análise de screenshots, diagramas e mockups

**Core**
- [ ] Compatibilidade MCP (Model Context Protocol) — expor skills como tools MCP e consumir servidores MCP externos
- [ ] Agentes paralelos — `parallel()` wrapper para rodar agentes concorrentemente e agregar resultados
- [ ] `SkillMiddleware` — hooks de interceptação para logging, rate-limiting e cache de tool calls
- [ ] Publicação npm — publicar os pacotes `@omni-ai/*` no registro público do npm

---

## Troubleshooting

**`omni: command not found`**
O CLI não está vinculado globalmente. Execute `pnpm --filter @omni-ai/cli link --global` na raiz do `omni-ai`, ou use `node packages/cli/dist/bin.js` diretamente.

**`Provider "anthropic" not found in config`**
O arquivo `config/omni-ai.yaml` não existe ou não declara o provider. Execute `omni init` para criá-lo, ou copie `config/omni-ai.example.yaml`.

**`Error: ANTHROPIC_API_KEY is not set`**
A variável de ambiente não está carregada. Verifique se `.env` existe e contém a chave. O CLI carrega `.env` automaticamente, mas você pode validar com `node -e "require('dotenv').config(); console.log(process.env.ANTHROPIC_API_KEY)"`.

**`maxIterations exceeded`**
O agente atingiu o limite de iterações sem concluir. Aumente `maxIterations` no YAML do agente ou torne o prompt mais específico para reduzir o número de tool calls.

**Tokens consumidos muito altos**
Use `ObservationMaskingCompactor` via API programática para mascarar tool results antigos. Reduz o contexto em até 70% em agentes intensivos em leitura de arquivos.

**`Access denied: path resolves outside the working directory`**
O agente tentou acessar um arquivo fora do `cwd`. Execute o comando de dentro do diretório do projeto alvo, ou verifique se o agente está usando paths relativos corretos.

**Build falha com `Cannot find module`**
O pacote referenciado não foi buildado ainda. Execute `pnpm build` na raiz para compilar todos os pacotes na ordem correta de dependências.

---

## Licença

MIT
