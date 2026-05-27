import { describe, expect, it } from "vitest";
import type { EvalResult } from "../../src/commands/eval.js";
import { buildReport, matchCase, normalize } from "../../src/commands/eval.js";

describe("normalize", () => {
  it("trims whitespace", () => {
    expect(normalize("  hello  ")).toBe("hello");
  });

  it("lowercases", () => {
    expect(normalize("Hello World")).toBe("hello world");
  });

  it("collapses internal whitespace", () => {
    expect(normalize("foo   bar\t baz")).toBe("foo bar baz");
  });
});

describe("matchCase", () => {
  it("returns exact for identical content", () => {
    expect(matchCase("The answer is 42", "The answer is 42")).toBe("exact");
  });

  it("returns exact ignoring case and extra spaces", () => {
    expect(matchCase("The Answer", "  the answer  ")).toBe("exact");
  });

  it("returns contains when expected is substring of actual", () => {
    expect(matchCase("answer", "The answer is found in the response")).toBe("contains");
  });

  it("returns miss when expected not in actual", () => {
    expect(matchCase("42", "The result is unknown")).toBe("miss");
  });

  it("returns miss for empty actual", () => {
    expect(matchCase("expected", "")).toBe("miss");
  });
});

describe("buildReport", () => {
  const results: EvalResult[] = [
    { input: "q1", expected: "a1", actual: "a1", match: "exact" },
    { input: "q2", expected: "a2", actual: "contains a2 here", match: "contains" },
    { input: "q3", expected: "a3", actual: "wrong", match: "miss" },
  ];

  it("counts passed as exact + contains", () => {
    const report = buildReport("agent", results);
    expect(report.passed).toBe(2);
  });

  it("calculates score correctly", () => {
    const report = buildReport("agent", results);
    expect(report.score).toBeCloseTo(2 / 3);
  });

  it("sets total to array length", () => {
    const report = buildReport("agent", results);
    expect(report.total).toBe(3);
  });

  it("returns score 0 for empty results", () => {
    const report = buildReport("agent", []);
    expect(report.score).toBe(0);
    expect(report.total).toBe(0);
  });

  it("returns score 1.0 when all pass", () => {
    const allPass: EvalResult[] = [
      { input: "q", expected: "a", actual: "a", match: "exact" },
      { input: "q2", expected: "b", actual: "b", match: "exact" },
    ];
    const report = buildReport("agent", allPass);
    expect(report.score).toBe(1);
  });

  it("preserves agent name", () => {
    const report = buildReport("my-agent", results);
    expect(report.agent).toBe("my-agent");
  });
});
