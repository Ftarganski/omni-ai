import { describe, expect, it } from "vitest";
import { formatAsJson, formatAsMarkdown } from "../../src/commands/export.js";

const session = { resourceId: "user1", threadId: "thread1" };
const messages = [
  { role: "user", content: "Hello", timestamp: 1_000_000 },
  { role: "assistant", content: "Hi there!", timestamp: 2_000_000 },
];

describe("formatAsMarkdown", () => {
  it("includes session header", () => {
    const result = formatAsMarkdown(session, messages);
    expect(result).toContain("# Session: user1 / thread1");
  });

  it("includes all message contents", () => {
    const result = formatAsMarkdown(session, messages);
    expect(result).toContain("Hello");
    expect(result).toContain("Hi there!");
  });

  it("includes exported timestamp", () => {
    const result = formatAsMarkdown(session, messages);
    expect(result).toContain("Exported:");
  });

  it("returns empty body for zero messages", () => {
    const result = formatAsMarkdown(session, []);
    expect(result).toContain("# Session:");
    expect(result).not.toContain("### ");
  });
});

describe("formatAsJson", () => {
  it("returns valid JSON", () => {
    const result = formatAsJson(session, messages);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes session and messages fields", () => {
    const parsed = JSON.parse(formatAsJson(session, messages));
    expect(parsed.session).toEqual(session);
    expect(parsed.messages).toHaveLength(2);
  });

  it("preserves message content exactly", () => {
    const parsed = JSON.parse(formatAsJson(session, messages));
    expect(parsed.messages[0].content).toBe("Hello");
    expect(parsed.messages[1].content).toBe("Hi there!");
  });
});
