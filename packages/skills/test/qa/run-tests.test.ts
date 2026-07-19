import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseTestOutput, runTestsSkill } from "../../src/qa/run-tests.js";

const jestShapedOutput = {
  numTotalTests: 3,
  numPassedTests: 2,
  numFailedTests: 1,
  testResults: [
    {
      name: "/repo/src/orders.service.spec.ts",
      status: "passed",
      assertionResults: [{ status: "passed" }, { status: "passed" }],
    },
    {
      name: "/repo/src/orders.resolver.spec.ts",
      status: "failed",
      assertionResults: [{ status: "failed", failureMessages: ["expected true to be false"] }],
    },
  ],
};

describe("parseTestOutput", () => {
  it("normalizes jest/vitest json-reporter output into files with pass/fail status", () => {
    const result = parseTestOutput(JSON.stringify(jestShapedOutput));
    expect(result.total).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toEqual({
      file: "/repo/src/orders.service.spec.ts",
      status: "passed",
      failureMessages: [],
    });
    expect(result.files[1].status).toBe("failed");
    expect(result.files[1].failureMessages).toContain("expected true to be false");
  });

  it("derives totals from files when reporter omits numeric summary fields", () => {
    const raw = JSON.stringify({
      testResults: [
        { name: "a.spec.ts", status: "passed", assertionResults: [{ status: "passed" }] },
        { name: "b.spec.ts", status: "failed", assertionResults: [{ status: "failed" }] },
      ],
    });
    const result = parseTestOutput(raw);
    expect(result.total).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("tolerates leading non-JSON noise (e.g. npm/npx banner lines) before the JSON payload", () => {
    const raw = `npm warn deprecated something\n${JSON.stringify(jestShapedOutput)}`;
    const result = parseTestOutput(raw);
    expect(result.total).toBe(3);
  });
});

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "omni-run-tests-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function nodePrintCommand(payload: unknown): Promise<string> {
  await writeFile(join(projectDir, "payload.json"), JSON.stringify(payload), "utf-8");
  await writeFile(
    join(projectDir, "print-payload.cjs"),
    "console.log(require('fs').readFileSync(require('path').join(__dirname, 'payload.json'), 'utf-8'));",
    "utf-8"
  );
  return "node print-payload.cjs";
}

describe("runTestsSkill", () => {
  it("runs the configured command and returns a normalized result", async () => {
    const result = await runTestsSkill.execute(
      { cwd: projectDir, runner: "vitest", command: await nodePrintCommand(jestShapedOutput) },
      {} as never
    );
    expect(result.runner).toBe("vitest");
    expect(result.total).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.files).toHaveLength(2);
  });

  it("attaches the coverage summary when coverage-summary.json exists in cwd", async () => {
    await mkdir(join(projectDir, "coverage"), { recursive: true });
    await writeFile(
      join(projectDir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 80 },
          statements: { pct: 78 },
          branches: { pct: 60 },
          functions: { pct: 90 },
        },
      }),
      "utf-8"
    );

    const result = await runTestsSkill.execute(
      { cwd: projectDir, runner: "vitest", command: await nodePrintCommand(jestShapedOutput) },
      {} as never
    );

    expect(result.coverage).toEqual({ lines: 80, statements: 78, branches: 60, functions: 90 });
  });

  it("computes coverageDelta against previousCoverage", async () => {
    await mkdir(join(projectDir, "coverage"), { recursive: true });
    await writeFile(
      join(projectDir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 80 },
          statements: { pct: 78 },
          branches: { pct: 60 },
          functions: { pct: 90 },
        },
      }),
      "utf-8"
    );

    const result = await runTestsSkill.execute(
      {
        cwd: projectDir,
        runner: "vitest",
        command: await nodePrintCommand(jestShapedOutput),
        previousCoverage: { lines: 70, statements: 70, branches: 50, functions: 85 },
      },
      {} as never
    );

    expect(result.coverageDelta).toEqual({ lines: 10, statements: 8, branches: 10, functions: 5 });
  });

  it("omits coverage fields when no coverage-summary.json is present", async () => {
    const result = await runTestsSkill.execute(
      { cwd: projectDir, runner: "vitest", command: await nodePrintCommand(jestShapedOutput) },
      {} as never
    );
    expect(result.coverage).toBeUndefined();
    expect(result.coverageDelta).toBeUndefined();
  });

  it("rejects when the command produces no output at all", async () => {
    await expect(
      runTestsSkill.execute({ cwd: projectDir, runner: "vitest", command: 'node -e "process.exit(1)"' }, {} as never)
    ).rejects.toThrow();
  });
});
