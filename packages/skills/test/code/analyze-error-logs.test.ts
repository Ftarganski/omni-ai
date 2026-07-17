import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeErrorLogsSkill, parseStackTrace } from "../../src/code/analyze-error-logs.js";

describe("parseStackTrace", () => {
  it("parses frames with a function name", () => {
    const frames = parseStackTrace("Error: boom\n    at calculateTotal (src/orders.ts:12:7)");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ functionName: "calculateTotal", file: "src/orders.ts", line: 12, column: 7 });
  });

  it("parses frames without a function name", () => {
    const frames = parseStackTrace("    at src/orders.ts:12:7");
    expect(frames[0]).toMatchObject({ file: "src/orders.ts", line: 12, column: 7 });
  });

  it("keeps unparseable frame lines with only raw text", () => {
    const frames = parseStackTrace("    at <anonymous>");
    expect(frames[0].raw).toBe("at <anonymous>");
    expect(frames[0].file).toBeUndefined();
  });

  it("ignores non-frame lines", () => {
    const frames = parseStackTrace("TypeError: cannot read property 'x' of undefined\n    at foo (a.ts:1:1)");
    expect(frames).toHaveLength(1);
  });
});

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-error-logs-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeErrorLogsSkill", () => {
  it("correlates a frame with a real source file and returns the probable cause", async () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`);
    lines[9] = "throw new Error('boom')"; // line 10
    await writeFile(join(tempDir, "src", "orders.ts"), lines.join("\n"), "utf-8");

    const stackTrace = "Error: boom\n    at calculateTotal (src/orders.ts:10:5)\n    at node_modules/lib/index.js:1:1";

    const result = await analyzeErrorLogsSkill.execute({ stackTrace, directory: tempDir }, {} as never);

    expect(result.frames).toHaveLength(2);
    expect(result.probableCause?.file).toBe(join(tempDir, "src", "orders.ts"));
    expect(result.probableCause?.line).toBe(10);
    expect(result.probableCause?.snippet).toContain("throw new Error('boom')");
  });

  it("skips node_modules frames when picking the probable cause", async () => {
    const stackTrace = "Error: boom\n    at internal (node_modules/lib/index.js:1:1)";

    const result = await analyzeErrorLogsSkill.execute({ stackTrace, directory: tempDir }, {} as never);

    expect(result.probableCause).toBeUndefined();
  });

  it("returns no probableCause when no frame resolves to an existing file", async () => {
    const stackTrace = "Error: boom\n    at foo (src/does-not-exist.ts:1:1)";

    const result = await analyzeErrorLogsSkill.execute({ stackTrace, directory: tempDir }, {} as never);

    expect(result.probableCause).toBeUndefined();
  });
});
