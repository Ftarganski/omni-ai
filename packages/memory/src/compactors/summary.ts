import type { ICompactor, IProvider, Message } from "@omni-ai/core";

function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

function formatForSummary(messages: Message[]): string {
  return messages
    .map(m => {
      const label = m.role === "assistant" ? "Assistant" : "User/Tool";
      return `[${label}]: ${m.content}`;
    })
    .join("\n\n");
}

/**
 * Summarizes older messages with one LLM call, then replaces them with the
 * summary. Keeps the most recent N messages verbatim for coherence.
 *
 * Cost: 1 LLM call per compaction trigger — saves 5–10 calls in subsequent
 * iterations by reducing re-sent tokens.
 */
export class SummaryCompactor implements ICompactor {
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

  async compact(messages: Message[], provider: IProvider): Promise<Message[]> {
    if (messages.length <= this.lastMessages) return messages;

    const cutoff = messages.length - this.lastMessages;
    const toSummarize = messages.slice(0, cutoff);
    const toKeep = messages.slice(cutoff);

    const summaryResponse = await provider.complete({
      messages: [
        {
          role: "user",
          content: [
            "Summarize the following conversation history concisely.",
            "Preserve: decisions made, key facts found, files read, errors encountered, and current task state.",
            "Omit: raw file contents, full search results, repetitive tool outputs.",
            "Write the summary as a compact factual paragraph or bullet list.",
            "",
            "--- CONVERSATION TO SUMMARIZE ---",
            formatForSummary(toSummarize),
          ].join("\n"),
        },
      ],
      systemPrompt: "You are a precise conversation summarizer. Be concise and factual.",
      temperature: 0.1,
    });

    const summaryMsg: Message = {
      role: "user",
      content: `[Context summary — ${toSummarize.length} messages compressed]:\n${summaryResponse.content}`,
    };

    return [summaryMsg, ...toKeep];
  }
}
