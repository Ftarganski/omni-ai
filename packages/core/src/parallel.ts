import type { Runtime } from "./bootstrap.js";
import type { AgentRunOptions, AgentRunResult, SessionId } from "./types.js";

export interface ParallelRunOptions {
  agents: string[];
  input: string;
  session?: SessionId;
  onToken?: (agent: string, chunk: string) => void;
}

export type ParallelAgentResult = AgentRunResult | { error: string };

export interface ParallelRunResult {
  results: Record<string, ParallelAgentResult>;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Runs multiple agents concurrently on the same input and aggregates their results.
 * Uses Promise.allSettled so a single failure does not cancel the other agents.
 */
export async function parallel(runtime: Runtime, opts: ParallelRunOptions): Promise<ParallelRunResult> {
  const runOpts: Omit<AgentRunOptions, "input"> = {
    session: opts.session,
  };

  const settled = await Promise.allSettled(
    opts.agents.map((name) => {
      const agentOpts: AgentRunOptions = {
        ...runOpts,
        input: opts.input,
        ...(opts.onToken ? { onToken: (chunk) => opts.onToken?.(name, chunk) } : {}),
      };
      return runtime.run(name, opts.input, agentOpts);
    })
  );

  const results: Record<string, ParallelAgentResult> = {};
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < opts.agents.length; i++) {
    const name = opts.agents[i];
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      results[name] = outcome.value;
      totalInput += outcome.value.usage?.inputTokens ?? 0;
      totalOutput += outcome.value.usage?.outputTokens ?? 0;
    } else {
      results[name] = {
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      };
    }
  }

  return { results, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
}
