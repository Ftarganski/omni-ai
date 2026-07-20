import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Target project root directory"),
  command: z
    .string()
    .default("npm audit --json")
    .describe('Audit command to run — override with e.g. "pnpm audit --json"'),
});

export type AuditDependenciesInput = z.infer<typeof InputSchema>;

export interface DependencyAdvisory {
  name: string;
  severity: string;
  title: string;
  url?: string;
}

export interface AuditSummary {
  total: number;
  bySeverity: Record<string, number>;
  advisories: DependencyAdvisory[];
}

interface NpmV7AuditOutput {
  vulnerabilities?: Record<
    string,
    { severity: string; via: Array<string | { title: string; url?: string; severity?: string }> }
  >;
  metadata?: { vulnerabilities?: Record<string, number> };
}

interface LegacyAuditOutput {
  advisories?: Record<string, { module_name: string; severity: string; title: string; url?: string }>;
}

function runAuditCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, { cwd, shell: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("close", () => {
      // `audit` exits non-zero when vulnerabilities are found — that's a valid result, not a failure.
      const out = Buffer.concat(stdout).toString();
      if (out.trim()) {
        resolvePromise(out);
      } else {
        reject(new Error(Buffer.concat(stderr).toString().trim() || `${command} produced no output`));
      }
    });
    proc.on("error", reject);
  });
}

export function parseAuditOutput(raw: string): AuditSummary {
  const parsed = JSON.parse(raw) as NpmV7AuditOutput & LegacyAuditOutput;
  const advisories: DependencyAdvisory[] = [];

  if (parsed.advisories) {
    for (const advisory of Object.values(parsed.advisories)) {
      advisories.push({
        name: advisory.module_name,
        severity: advisory.severity,
        title: advisory.title,
        url: advisory.url,
      });
    }
  } else if (parsed.vulnerabilities) {
    for (const [name, vuln] of Object.entries(parsed.vulnerabilities)) {
      for (const via of vuln.via) {
        if (typeof via === "object") {
          advisories.push({ name, severity: via.severity ?? vuln.severity, title: via.title, url: via.url });
        }
      }
    }
  }

  const bySeverity: Record<string, number> = {};
  if (parsed.metadata?.vulnerabilities) {
    for (const [severity, count] of Object.entries(parsed.metadata.vulnerabilities)) {
      if (severity !== "total") bySeverity[severity] = count;
    }
  } else {
    for (const advisory of advisories) {
      bySeverity[advisory.severity] = (bySeverity[advisory.severity] ?? 0) + 1;
    }
  }

  const total = parsed.metadata?.vulnerabilities?.total ?? Object.values(bySeverity).reduce((a, b) => a + b, 0);

  return { total, bySeverity, advisories };
}

export const auditDependenciesSkill: ISkill<AuditDependenciesInput, AuditSummary> = {
  name: "audit-dependencies",
  description:
    "Run a dependency vulnerability audit (npm audit --json by default, override command for pnpm/yarn) and " +
    "summarize findings by severity with the underlying advisories. Use this before merging a dependency bump " +
    "or as part of a periodic security sweep.",

  async execute(input: AuditDependenciesInput): Promise<AuditSummary> {
    const { cwd, command } = InputSchema.parse(input);
    const raw = await runAuditCommand(command, resolve(cwd));
    return parseAuditOutput(raw);
  },
};
