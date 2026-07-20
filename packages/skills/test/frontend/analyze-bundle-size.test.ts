import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeBundleSizeSkill, analyzeMetafile } from "../../src/frontend/analyze-bundle-size.js";

const sampleMetafile = {
  outputs: {
    "dist/main.js": { bytes: 8000 },
    "dist/vendor.js": { bytes: 2000 },
    "dist/main.js.map": { bytes: 50000 },
  },
};

describe("analyzeMetafile", () => {
  it("excludes .map files from totals and ranking", () => {
    const result = analyzeMetafile(JSON.stringify(sampleMetafile), 10);
    expect(result.totalBytes).toBe(10000);
    expect(result.entries.map((e) => e.path)).not.toContain("dist/main.js.map");
  });

  it("sorts entries by bytes descending and computes pctOfTotal", () => {
    const result = analyzeMetafile(JSON.stringify(sampleMetafile), 10);
    expect(result.entries[0].path).toBe("dist/main.js");
    expect(result.entries[0].pctOfTotal).toBeCloseTo(0.8);
    expect(result.entries[1].pctOfTotal).toBeCloseTo(0.2);
  });

  it("respects topN", () => {
    const result = analyzeMetafile(JSON.stringify(sampleMetafile), 1);
    expect(result.entries).toHaveLength(1);
  });
});

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "omni-bundle-size-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("analyzeBundleSizeSkill", () => {
  it("reads an existing metafile without running a command", async () => {
    await writeFile(join(projectDir, "meta.json"), JSON.stringify(sampleMetafile), "utf-8");
    const result = await analyzeBundleSizeSkill.execute({ cwd: projectDir }, {} as never);
    expect(result.totalBytes).toBe(10000);
  });

  it("runs the provided command before reading the metafile", async () => {
    await writeFile(
      join(projectDir, "gen-meta.cjs"),
      `require('fs').writeFileSync('meta.json', JSON.stringify(${JSON.stringify(sampleMetafile)}));`,
      "utf-8"
    );
    const result = await analyzeBundleSizeSkill.execute({ cwd: projectDir, command: "node gen-meta.cjs" }, {} as never);
    expect(result.totalBytes).toBe(10000);
  });
});
