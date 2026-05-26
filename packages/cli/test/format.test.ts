import { describe, expect, it } from "vitest";
import { agentHeader, errorLine, iterationLine, savedLine, stepLine, tokenSummary } from "../src/utils/format.js";

describe("format utilities", () => {
  it("agentHeader includes agent name and provider/model", () => {
    const result = agentHeader("backend-dev", "anthropic / claude-sonnet-4-6");
    expect(result).toContain("backend-dev");
    expect(result).toContain("anthropic / claude-sonnet-4-6");
  });

  it("stepLine includes skill name", () => {
    const result = stepLine("read-file", "src/app.ts");
    expect(result).toContain("read-file");
    expect(result).toContain("src/app.ts");
  });

  it("stepLine works without detail", () => {
    const result = stepLine("write-file");
    expect(result).toContain("write-file");
  });

  it("tokenSummary includes input and output token counts", () => {
    const result = tokenSummary(1000, 500);
    expect(result).toContain("1,000");
    expect(result).toContain("500");
  });

  it("iterationLine formats singular correctly", () => {
    expect(iterationLine(1)).toContain("1 iteração");
  });

  it("iterationLine formats plural correctly", () => {
    expect(iterationLine(3)).toContain("3 iterações");
  });

  it("errorLine includes the message", () => {
    expect(errorLine("something went wrong")).toContain("something went wrong");
  });

  it("savedLine includes the path", () => {
    expect(savedLine("output.md")).toContain("output.md");
  });
});
