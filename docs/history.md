# `@omni-ai/history` — third-party agent history

Imports, normalizes and makes searchable the local history of other agent harnesses
(Claude Code, Codex, Cursor, ...), inspired by the `sources → import → search/show/locate`
model from `ctx`. Local-only by design: no import or search makes network calls, calls a
model API, or requires an API key — it only reads history files already owned by the
provider on the current machine.

## Project isolation (scope) — read before using

On a machine with multiple projects/clients, one harness's history (e.g. Claude Code)
usually covers **every** project, not just the current one. Without isolation, an agent
running in `project-a` that calls `search-history` could get back content from
`project-b` — code, decisions, and conversation snippets from a different client leaking
into another project's context.

To prevent this, every `HistorySource`/`HistorySession` carries an optional `scope` field
(defined by the provider — e.g. the project directory name in Claude Code, or the `cwd`
recorded inside the session file in Codex). Isolation is enforced at three points:

1. **CLI (`omni history search`)** — defaults to restricting to the current directory's
   scope (`encodeProjectScope(process.cwd())`). `--all-projects` explicitly opts into
   searching everything.
2. **Automatic refresh (`--refresh auto`)** — the automatic catch-up before a search only
   imports sources whose `scope` matches the search's scope. This prevents an ordinary
   search from triggering, as a side effect, the reading of entire other-project
   transcripts.
3. **MCP skills (`search-history`, `show-history-event`)** — same rule: scoped by default,
   `allProjects: true` to opt out. `show-history-event` additionally refuses to show an
   event belonging to a different scope than the caller's, even if the numeric id is known
   (ids are a global sequence across every imported project).

`omni history import`/`omni history sources` still operate broadly when explicitly
requested (`--all`) — this is intentional, it's the "full catch-up" equivalent of `ctx
import --all`. What this model prevents is **implicit** leakage, not explicit import.

## Data model

```
sources     — a history location owned by a provider (directory/file)
sessions    — a conversation imported from a source, inheriting the source's scope
events      — a normalized message within a session (role, content, tool_name, ordinal)
citations   — points an event back to the original file/line it came from
```

SQLite schema (additive — doesn't rewrite `SQLiteMemoryStore`, which remains the agents'
memory contract via `IMemoryStore`):

```sql
sources(id, provider, path, native_import, importable, reason, scope)
sessions(id, provider, source_session_id, imported_at, scope)   -- UNIQUE(provider, scope, source_session_id)
events(id, session_id, role, content, tool_name, ordinal, ts)
events_fts                                                      -- FTS5 over events.content
citations(event_id, source_path, source_line)                   -- PRIMARY KEY(event_id)
```

By default, the database lives at `~/.omni-ai/history.db` (`$HOME`/`$USERPROFILE`), separate
from the `~/.omni-ai/sessions.db` used by `SQLiteMemoryStore`.

## `IHistoryParser` contract

```typescript
interface IHistoryParser {
  readonly provider: string;
  discover(): Promise<HistorySource[]>;                    // only lists what exists — never reads content
  import(source: HistorySource): Promise<HistoryImportResult[]>;  // reads and normalizes one source
}
```

Two reference parsers, deliberately using very different formats, validate that the
contract generalizes:

| Parser | Provider | Format | How it derives scope |
|--------|----------|--------|------------------------|
| `ClaudeCodeHistoryParser` | `claude-code` | `.jsonl` tree (1 line = 1 event) | 1 project subdirectory = 1 scope |
| `CodexHistoryParser` | `codex` | 1 `.json` file per session (whole document) | `cwd` field inside the file |

A new provider = one new class implementing `IHistoryParser` + registration in
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

- `sources` — discovery only (directory/file names), never reads conversation content.
- `import` — explicit read, writes to the local `history.db`. Never writes to the
  original source or calls an LLM.
- `search` — FTS5 with per-session diversity (at most N hits per session, so one large
  session can't dominate the results page) and `--refresh` (`auto`/`off`/`strict`)
  controlling the catch-up before the query.
- `show` / `locate` — inspects a specific event/session and locates the original source
  file (citation), including a warning when the original file has moved or been removed.
- `doctor` — diagnostics: non-importable sources and broken citations (original file no
  longer exists).

## MCP skills

`searchHistorySkill` (`search-history`) and `showEventSkill` (`show-history-event`),
exported from `@omni-ai/history` and registered in `omni mcp serve`. Both are
**read-only over what's already been imported** — they never trigger import/refresh, so
calling them never reads another project's transcripts off disk, even if the local index
already contains them (the scope filter hides them).

## Adding a new provider parser

1. Create `packages/history/src/parsers/<provider>.ts` implementing `IHistoryParser`.
2. If the format has a notion of project/workspace, populate `HistorySource.scope` /
   `HistorySession.scope` — reuse `encodeProjectScope()` if the scope comes from an
   absolute path.
3. Register it in `buildHistoryRegistry()` (`packages/cli/src/commands/history/shared.ts`).
4. Add tests in `packages/history/test/<provider>.test.ts` covering: importable/
   non-importable discovery, import with invalid lines/entries skipped, and idempotent
   re-import (must not violate the `citations → events` FK).
