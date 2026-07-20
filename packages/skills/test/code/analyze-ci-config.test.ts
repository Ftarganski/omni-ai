import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeCiConfigSkill, analyzeWorkflow } from "../../src/code/analyze-ci-config.js";

describe("analyzeWorkflow", () => {
  it("flags a job with no timeout-minutes", () => {
    const gaps = analyzeWorkflow(`
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: node_modules
          key: deps
`);
    expect(gaps.some((g) => g.rule === "missing-timeout" && g.job === "build")).toBe(true);
  });

  it("flags a job with no cache step", () => {
    const gaps = analyzeWorkflow(`
jobs:
  build:
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`);
    expect(gaps.some((g) => g.rule === "missing-cache" && g.job === "build")).toBe(true);
  });

  it("does not flag missing-cache when setup-node has cache option", () => {
    const gaps = analyzeWorkflow(`
jobs:
  build:
    timeout-minutes: 10
    steps:
      - uses: actions/setup-node@v4
        with:
          cache: npm
`);
    expect(gaps.some((g) => g.rule === "missing-cache")).toBe(false);
  });

  it("flags duplicated run commands within the same job", () => {
    const gaps = analyzeWorkflow(`
jobs:
  build:
    timeout-minutes: 10
    steps:
      - uses: actions/cache@v4
      - run: npm install
      - run: npm install
`);
    expect(gaps.some((g) => g.rule === "duplicate-step" && g.job === "build")).toBe(true);
  });

  it("returns no gaps for a well-configured workflow", () => {
    const gaps = analyzeWorkflow(`
jobs:
  build:
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          cache: npm
      - run: npm install
      - run: npm test
`);
    expect(gaps).toHaveLength(0);
  });
});

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-ci-config-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeCiConfigSkill", () => {
  it("reads the workflow file and returns gaps with the source path", async () => {
    const path = join(tempDir, "ci.yml");
    await writeFile(path, "jobs:\n  build:\n    steps:\n      - run: npm test\n", "utf-8");
    const result = await analyzeCiConfigSkill.execute({ path }, {} as never);
    expect(result.path).toBe(path);
    expect(result.gaps.length).toBeGreaterThan(0);
  });
});
