import { contentToString, type Message } from "@omni-ai/core";

export function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(contentToString(m.content).length / 4), 0);
}
