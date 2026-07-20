import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeDependencyGraphSkill } from "../../src/architecture/analyze-dependency-graph.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-dep-graph-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeDependencyGraphSkill", () => {
  it("maps edges for an acyclic graph and reports no cycles", async () => {
    await writeFile(join(tempDir, "src", "a.ts"), 'import { b } from "./b";\nexport const a = b;\n', "utf-8");
    await writeFile(join(tempDir, "src", "b.ts"), "export const b = 1;\n", "utf-8");

    const result = await analyzeDependencyGraphSkill.execute({ directory: tempDir }, {} as never);

    expect(result.edges).toContainEqual({ from: join(tempDir, "src", "a.ts"), to: join(tempDir, "src", "b.ts") });
    expect(result.cycles).toHaveLength(0);
  });

  it("detects a 2-node cycle", async () => {
    await writeFile(join(tempDir, "src", "a.ts"), 'import { b } from "./b";\n', "utf-8");
    await writeFile(join(tempDir, "src", "b.ts"), 'import { a } from "./a";\n', "utf-8");

    const result = await analyzeDependencyGraphSkill.execute({ directory: tempDir }, {} as never);

    expect(result.cycles.length).toBeGreaterThan(0);
    const cycleFiles = result.cycles[0];
    expect(cycleFiles).toContain(join(tempDir, "src", "a.ts"));
    expect(cycleFiles).toContain(join(tempDir, "src", "b.ts"));
  });

  it("detects a 3-node cycle", async () => {
    await writeFile(join(tempDir, "src", "a.ts"), 'import { b } from "./b";\n', "utf-8");
    await writeFile(join(tempDir, "src", "b.ts"), 'import { c } from "./c";\n', "utf-8");
    await writeFile(join(tempDir, "src", "c.ts"), 'import { a } from "./a";\n', "utf-8");

    const result = await analyzeDependencyGraphSkill.execute({ directory: tempDir }, {} as never);

    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.cycles[0]).toHaveLength(4);
  });

  it("flags a file whose outgoing import count exceeds the coupling threshold", async () => {
    const imports = Array.from({ length: 5 }, (_, i) => `import "./m${i}";`).join("\n");
    await writeFile(join(tempDir, "src", "hub.ts"), imports, "utf-8");
    for (let i = 0; i < 5; i++) {
      await writeFile(join(tempDir, "src", `m${i}.ts`), "export const x = 1;\n", "utf-8");
    }

    const result = await analyzeDependencyGraphSkill.execute({ directory: tempDir, couplingThreshold: 3 }, {} as never);

    expect(result.excessiveCoupling).toContainEqual({ file: join(tempDir, "src", "hub.ts"), outDegree: 5 });
  });

  it("resolves imports pointing to a directory's index file", async () => {
    await mkdir(join(tempDir, "src", "utils"), { recursive: true });
    await writeFile(join(tempDir, "src", "utils", "index.ts"), "export const util = 1;\n", "utf-8");
    await writeFile(join(tempDir, "src", "consumer.ts"), 'import { util } from "./utils";\n', "utf-8");

    const result = await analyzeDependencyGraphSkill.execute({ directory: tempDir }, {} as never);

    expect(result.edges).toContainEqual({
      from: join(tempDir, "src", "consumer.ts"),
      to: join(tempDir, "src", "utils", "index.ts"),
    });
  });
});
