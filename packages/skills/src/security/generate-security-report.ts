import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const DependencyAdvisorySchema = z.object({
  name: z.string(),
  severity: z.string(),
  title: z.string(),
  url: z.string().optional(),
});

const SecretFindingSchema = z.object({
  rule: z.string(),
  line: z.number(),
  snippet: z.string(),
});

const OwaspFindingSchema = z.object({
  rule: z.string(),
  category: z.string(),
  severity: z.string(),
  line: z.number(),
  snippet: z.string(),
  message: z.string(),
});

const InputSchema = z.object({
  dependencyAdvisories: z
    .array(DependencyAdvisorySchema)
    .default([])
    .describe("advisories[] from the audit-dependencies skill output"),
  secretFindings: z.array(SecretFindingSchema).default([]).describe("findings[] from the scan-secrets skill output"),
  owaspFindings: z
    .array(OwaspFindingSchema)
    .default([])
    .describe("findings[] from the scan-owasp-patterns skill output"),
});

export type GenerateSecurityReportInput = z.infer<typeof InputSchema>;

export interface SecurityReportFinding {
  source: "audit-dependencies" | "scan-secrets" | "scan-owasp-patterns";
  severity: string;
  title: string;
  remediation: string;
}

export interface GenerateSecurityReportOutput {
  markdown: string;
  summary: Record<string, number>;
  total: number;
  findings: SecurityReportFinding[];
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, moderate: 2, medium: 2, low: 3 };

function severityRank(severity: string): number {
  return SEVERITY_RANK[severity.toLowerCase()] ?? 4;
}

function normalizeFindings(input: GenerateSecurityReportInput): SecurityReportFinding[] {
  const findings: SecurityReportFinding[] = [
    ...input.dependencyAdvisories.map((a) => ({
      source: "audit-dependencies" as const,
      severity: a.severity,
      title: `${a.name}: ${a.title}`,
      remediation: `Update ${a.name} to a patched version${a.url ? ` (see ${a.url})` : ""}.`,
    })),
    ...input.secretFindings.map((f) => ({
      source: "scan-secrets" as const,
      severity: "critical",
      title: `Possible leaked credential (${f.rule}) at line ${f.line}`,
      remediation: "Rotate the credential immediately and remove it from the codebase/history.",
    })),
    ...input.owaspFindings.map((f) => ({
      source: "scan-owasp-patterns" as const,
      severity: f.severity,
      title: `${f.category}: ${f.message}`,
      remediation: `Review line ${f.line} and fix per OWASP guidance for ${f.category}.`,
    })),
  ];

  return findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function renderMarkdown(findings: SecurityReportFinding[], summary: Record<string, number>): string {
  const summaryLines = Object.entries(summary)
    .sort(([a], [b]) => severityRank(a) - severityRank(b))
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");

  const findingLines = findings
    .map((f) => `### [${f.severity}] ${f.title}\n\n- Source: ${f.source}\n- Remediation: ${f.remediation}`)
    .join("\n\n");

  return `## Security Report\n\n### Summary\n\n${summaryLines}\n\n---\n\n${findingLines}`;
}

export const generateSecurityReportSkill: ISkill<GenerateSecurityReportInput, GenerateSecurityReportOutput> = {
  name: "generate-security-report",
  description:
    "Aggregate findings from audit-dependencies, scan-secrets and scan-owasp-patterns into a single report, " +
    "prioritized by severity, with a remediation suggestion per finding. Pass each skill's already-computed " +
    "output — this skill does not execute them itself. Use this to produce one consolidated security summary.",

  async execute(input: GenerateSecurityReportInput): Promise<GenerateSecurityReportOutput> {
    const parsed = InputSchema.parse(input);
    const findings = normalizeFindings(parsed);

    const summary: Record<string, number> = {};
    for (const f of findings) summary[f.severity] = (summary[f.severity] ?? 0) + 1;

    return {
      markdown: renderMarkdown(findings, summary),
      summary,
      total: findings.length,
      findings,
    };
  },
};
