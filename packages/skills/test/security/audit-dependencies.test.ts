import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditDependenciesSkill, parseAuditOutput } from "../../src/security/audit-dependencies.js";

const npmV7Output = {
  vulnerabilities: {
    lodash: {
      severity: "high",
      via: [{ title: "Prototype Pollution in lodash", url: "https://example.com/advisory/1", severity: "high" }],
    },
  },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
};

const legacyOutput = {
  advisories: {
    "1001": {
      module_name: "minimist",
      severity: "critical",
      title: "Prototype Pollution",
      url: "https://example.com/advisory/2",
    },
  },
};

describe("parseAuditOutput", () => {
  it("parses npm v7+ shaped output using metadata counts", () => {
    const result = parseAuditOutput(JSON.stringify(npmV7Output));
    expect(result.total).toBe(1);
    expect(result.bySeverity.high).toBe(1);
    expect(result.advisories).toEqual([
      {
        name: "lodash",
        severity: "high",
        title: "Prototype Pollution in lodash",
        url: "https://example.com/advisory/1",
      },
    ]);
  });

  it("parses legacy advisories-keyed output and derives counts from the advisories list", () => {
    const result = parseAuditOutput(JSON.stringify(legacyOutput));
    expect(result.total).toBe(1);
    expect(result.bySeverity.critical).toBe(1);
    expect(result.advisories[0].name).toBe("minimist");
  });

  it("returns zero total for a clean audit", () => {
    const result = parseAuditOutput(
      JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } })
    );
    expect(result.total).toBe(0);
    expect(result.advisories).toHaveLength(0);
  });
});

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "omni-audit-deps-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function fixtureCommand(payload: unknown): Promise<string> {
  await writeFile(join(projectDir, "payload.json"), JSON.stringify(payload), "utf-8");
  await writeFile(
    join(projectDir, "print-payload.cjs"),
    "console.log(require('fs').readFileSync(require('path').join(__dirname, 'payload.json'), 'utf-8'));",
    "utf-8"
  );
  return "node print-payload.cjs";
}

describe("auditDependenciesSkill", () => {
  it("runs the configured command and returns a parsed summary", async () => {
    const result = await auditDependenciesSkill.execute(
      { cwd: projectDir, command: await fixtureCommand(npmV7Output) },
      {} as never
    );
    expect(result.total).toBe(1);
    expect(result.bySeverity.high).toBe(1);
  });
});
