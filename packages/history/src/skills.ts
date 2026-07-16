import type { ISkill } from "@omni-ai/core";
import { HistoryStore } from "./store.js";
import type { HistoryEvent, HistorySearchHit } from "./types.js";

function defaultHistoryDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.omni-ai/history.db`;
}

/** Same encoding Claude Code uses for its per-project history directories. */
export function encodeProjectScope(absPath: string): string {
  return absPath.replace(/[^a-zA-Z0-9]/g, "-");
}

export interface SearchHistoryInput {
  query: string;
  /** Restrict to one project scope. Defaults to the caller's own project (derived from cwd). */
  scope?: string;
  /** Explicitly search across every imported project instead of just the caller's own. */
  allProjects?: boolean;
  limit?: number;
}

export interface SearchHistoryOutput {
  scope: string | null;
  hits: HistorySearchHit[];
}

/**
 * Read-only search over history already imported by `omni history import` — this skill
 * never triggers a fresh import itself, so calling it can't read another project's
 * transcripts off disk. Scoped to the caller's own project by default so an agent working
 * in one project never sees another project's imported history unless it explicitly asks
 * for allProjects:true.
 */
export const searchHistorySkill: ISkill<SearchHistoryInput, SearchHistoryOutput> = {
  name: "search-history",
  description:
    "Full-text search over already-imported third-party AI agent history (run `omni history import` first to populate it). " +
    "Scoped to the caller's own project by default — pass allProjects:true to search every imported project.",

  async execute(input: SearchHistoryInput): Promise<SearchHistoryOutput> {
    const scope = input.allProjects ? undefined : (input.scope ?? encodeProjectScope(process.cwd()));
    const store = new HistoryStore({ path: defaultHistoryDbPath() });
    try {
      const hits = store.search(input.query, { scope, limit: input.limit });
      return { scope: scope ?? null, hits };
    } finally {
      store.close();
    }
  },
};

export interface ShowHistoryEventInput {
  eventId: number;
  /** Events of context before/after, by ordinal. Default: 3. */
  window?: number;
  /** Allow showing an event outside the caller's own project scope. */
  allProjects?: boolean;
}

export interface ShowHistoryEventOutput {
  events: HistoryEvent[];
}

/**
 * Shows one imported event with surrounding context. Event ids are a flat sequence across
 * every imported project, so — unlike search — a numeric id alone carries no scope
 * information; this skill checks the event's session scope against the caller's own
 * project and refuses cross-project reads unless allProjects:true is passed explicitly.
 */
export const showEventSkill: ISkill<ShowHistoryEventInput, ShowHistoryEventOutput> = {
  name: "show-history-event",
  description:
    "Show one imported history event with N events of surrounding context. Refuses events that belong to a " +
    "different project scope than the caller's, unless allProjects:true is passed.",

  async execute(input: ShowHistoryEventInput): Promise<ShowHistoryEventOutput> {
    const store = new HistoryStore({ path: defaultHistoryDbPath() });
    try {
      const center = store.getEvent(input.eventId);
      if (!center) return { events: [] };

      if (!input.allProjects) {
        const session = store.getSession(center.sessionId);
        const callerScope = encodeProjectScope(process.cwd());
        if (session?.scope && session.scope !== callerScope) {
          throw new Error(
            `Event ${input.eventId} belongs to a different project scope ("${session.scope}"). Pass allProjects:true to override.`
          );
        }
      }

      return { events: store.getEventWindow(input.eventId, input.window ?? 3) };
    } finally {
      store.close();
    }
  },
};
