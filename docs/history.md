# `@omni-ai/history` — histórico de agentes de terceiros

Importa, normaliza e torna pesquisável o histórico local de outros harnesses de agente
(Claude Code, Codex, Cursor, ...), inspirado no modelo `sources → import → search/show/locate`
do `ctx`. Local-only por design: nenhum import ou busca faz chamadas de rede, chama API de
modelo ou requer API key — apenas lê arquivos de histórico já pertencentes ao provider na
máquina atual.

## Isolamento por projeto (scope) — leia antes de usar

Em uma máquina com múltiplos projetos/clientes, o histórico de um harness (ex: Claude Code)
normalmente cobre **todos** os projetos, não só o atual. Sem isolamento, um agente rodando em
`projeto-a` que chama `search-history` poderia receber de volta conteúdo de `projeto-b` —
código, decisões e trechos de conversa de um cliente diferente vazando para o contexto de
outro.

Para evitar isso, cada `HistorySource`/`HistorySession` carrega um campo opcional `scope`
(definido pelo provider — ex: nome do diretório do projeto no Claude Code, ou o `cwd` gravado
dentro do arquivo de sessão no Codex). O isolamento é reforçado em três pontos:

1. **CLI (`omni history search`)** — por padrão restringe ao scope do diretório atual
   (`encodeProjectScope(process.cwd())`). `--all-projects` opta explicitamente por buscar em
   tudo.
2. **Refresh automático (`--refresh auto`)** — o catch-up automático antes de uma busca só
   importa as sources cujo `scope` bate com o scope da busca. Isso evita que uma busca comum
   dispare, como efeito colateral, a leitura de transcripts de outros projetos inteiros.
3. **Skills MCP (`search-history`, `show-history-event`)** — mesma regra: escopo por padrão,
   `allProjects: true` para sair dele. `show-history-event` adicionalmente recusa mostrar um
   evento que pertença a um scope diferente do caller, mesmo que o id numérico seja conhecido
   (ids são uma sequência global entre todos os projetos importados).

`omni history import`/`omni history sources` continuam operando de forma ampla quando pedido
explicitamente (`--all`) — isso é intencional, é o "catch-up completo" equivalente ao `ctx
import --all`. O que este modelo impede é o vazamento **implícito**, não o import explícito.

## Modelo de dados

```
sources     — uma localização de histórico pertencente a um provider (diretório/arquivo)
sessions    — uma conversa importada de uma source, com scope herdado da source
events      — uma mensagem normalizada dentro de uma sessão (role, content, tool_name, ordinal)
citations   — aponta um event de volta para o arquivo/linha original de onde veio
```

Schema SQLite (aditivo — não reescreve `SQLiteMemoryStore`, que continua sendo o contrato de
memória dos agentes via `IMemoryStore`):

```sql
sources(id, provider, path, native_import, importable, reason, scope)
sessions(id, provider, source_session_id, imported_at, scope)   -- UNIQUE(provider, scope, source_session_id)
events(id, session_id, role, content, tool_name, ordinal, ts)
events_fts                                                      -- FTS5 sobre events.content
citations(event_id, source_path, source_line)                   -- PRIMARY KEY(event_id)
```

Por padrão, o banco fica em `~/.omni-ai/history.db` (`$HOME`/`$USERPROFILE`), separado do
`~/.omni-ai/sessions.db` usado pelo `SQLiteMemoryStore`.

## Contrato `IHistoryParser`

```typescript
interface IHistoryParser {
  readonly provider: string;
  discover(): Promise<HistorySource[]>;                    // só lista o que existe — não lê conteúdo
  import(source: HistorySource): Promise<HistoryImportResult[]>;  // lê e normaliza uma source
}
```

Dois parsers de referência, propositalmente com formatos bem diferentes, validam que o
contrato generaliza:

| Parser | Provider | Formato | Como descobre scope |
|--------|----------|---------|----------------------|
| `ClaudeCodeHistoryParser` | `claude-code` | árvore de `.jsonl` (1 linha = 1 evento) | 1 subdiretório de projeto = 1 scope |
| `CodexHistoryParser` | `codex` | 1 arquivo `.json` por sessão (documento inteiro) | campo `cwd` dentro do arquivo |

Um novo provider = uma nova classe implementando `IHistoryParser` + registro em
`buildHistoryRegistry()` (`packages/cli/src/commands/history/shared.ts`).

## CLI

```bash
omni history sources [--json]
omni history import --provider <name> [--path <dir>]
omni history import --all
omni history search "<query>" [--scope <name>] [--all-projects] [--session <id>] [--limit <n>] [--refresh auto|off|strict] [--json]
omni history show event <id> [--window <n>]
omni history show session <sessionId> [--format text|markdown] [--out <path>]
omni history locate event <id> [--json]
omni history locate session <sessionId> [--json]
omni history doctor [--json]
```

- `sources` — só descoberta (nomes de diretório/arquivo), nunca lê conteúdo de conversa.
- `import` — leitura explícita, escreve no `history.db` local. Nunca escreve na fonte
  original nem chama LLM.
- `search` — FTS5 com diversidade por sessão (no máx. N hits por sessão, evita que uma
  sessão grande domine a página) e `--refresh` (`auto`/`off`/`strict`) controlando o
  catch-up antes da query.
- `show` / `locate` — inspeção de um evento/sessão específico e localização do arquivo de
  origem (citation), incluindo aviso quando o arquivo original foi movido/removido.
- `doctor` — diagnóstico: sources não importáveis e citations quebradas (arquivo original
  não existe mais).

## Skills MCP

`searchHistorySkill` (`search-history`) e `showEventSkill` (`show-history-event`), exportadas
de `@omni-ai/history` e registradas em `omni mcp serve`. Ambas são **somente leitura sobre o
que já foi importado** — não disparam import/refresh, então chamá-las nunca lê transcripts de
outro projeto do disco, mesmo que o índice local já os contenha (o filtro de scope os
esconde).

## Adicionando um novo parser de provider

1. Criar `packages/history/src/parsers/<provider>.ts` implementando `IHistoryParser`.
2. Se o formato tiver noção de projeto/workspace, popular `HistorySource.scope` /
   `HistorySession.scope` — reaproveite `encodeProjectScope()` se o scope vier de um path
   absoluto.
3. Registrar em `buildHistoryRegistry()` (`packages/cli/src/commands/history/shared.ts`).
4. Adicionar testes em `packages/history/test/<provider>.test.ts` cobrindo: discovery
   importável/não importável, import com linhas/entradas inválidas ignoradas, e
   reimportação idempotente (não deve violar a FK `citations → events`).
