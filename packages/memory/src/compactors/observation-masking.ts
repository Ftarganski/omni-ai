import type { ICompactor, IProvider, Message } from "@omni-ai/core";
import { estimateTokens } from "../utils.js";

const TOOL_RESULT_PREFIX = "[Tool ";

function isToolResult(msg: Message): boolean {
  return msg.role === "user" && msg.content.startsWith(TOOL_RESULT_PREFIX);
}

/**
 * Replaces tool result content in older messages with a short token-count
 * placeholder. Preserves the agent's reasoning chain intact.
 *
 * Zero LLM calls — safest and cheapest compaction strategy.
 * Best for tool-heavy workloads where file contents / search results dominate context.
 */
export class ObservationMaskingCompactor implements ICompactor {
  private threshold: number;
  private lastMessages: number;

  /**
   * @param threshold Fraction of maxTokens at which to trigger. Default: 0.7
   * @param lastMessages Number of recent messages to keep verbatim. Default: 6
   */
  constructor(threshold = 0.7, lastMessages = 6) {
    this.threshold = threshold;
    this.lastMessages = lastMessages;
  }

  shouldCompact(messages: Message[], maxTokens: number): boolean {
    return estimateTokens(messages) > maxTokens * this.threshold;
  }

  async compact(messages: Message[], _provider: IProvider): Promise<Message[]> {
    if (messages.length <= this.lastMessages) return messages;

    const cutoff = messages.length - this.lastMessages;
    return messages.map((msg, i) => {
      if (i >= cutoff || !isToolResult(msg)) return msg;
      const tokenCount = Math.ceil(msg.content.length / 4);
      const match = /^\[Tool ([^\]]+) result\]:/.exec(msg.content);
      const toolName = match?.[1] ?? "unknown";
      return {
        role: msg.role,
        content: `[Tool ${toolName} result: masked, ~${tokenCount} tokens]`,
      };
    });
  }
}
