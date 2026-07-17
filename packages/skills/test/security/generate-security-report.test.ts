import { describe, expect, it } from "vitest";
import { generateSecurityReportSkill } from "../../src/security/generate-security-report.js";

describe("generateSecurityReportSkill", () => {
  it("aggregates findings from all three sources", async () => {
    const result = await generateSecurityReportSkill.execute(
      {
        dependencyAdvisories: [{ name: "lodash", severity: "high", title: "Prototype Pollution" }],
        secretFindings: [{ rule: "aws-access-key", line: 3, snippet: "AWS_KEY=[REDACTED]" }],
        owaspFindings: [
          {
            rule: "sql-injection",
            category: "A03:2021-Injection",
            severity: "high",
            line: 10,
            snippet: "db.query(...)",
            message: "SQL injection risk",
          },
        ],
      },
      {} as never
    );

    expect(result.total).toBe(3);
    expect(result.findings.map((f) => f.source)).toEqual(
      expect.arrayContaining(["audit-dependencies", "scan-secrets", "scan-owasp-patterns"])
    );
  });

  it("sorts findings by severity, critical first", async () => {
    const result = await generateSecurityReportSkill.execute(
      {
        dependencyAdvisories: [{ name: "pkg-a", severity: "low", title: "Minor issue" }],
        secretFindings: [{ rule: "jwt", line: 1, snippet: "token=[REDACTED]" }],
        owaspFindings: [],
      },
      {} as never
    );

    expect(result.findings[0].severity).toBe("critical");
    expect(result.findings[1].severity).toBe("low");
  });

  it("builds a summary count per severity", async () => {
    const result = await generateSecurityReportSkill.execute(
      {
        dependencyAdvisories: [
          { name: "a", severity: "high", title: "x" },
          { name: "b", severity: "high", title: "y" },
        ],
        secretFindings: [],
        owaspFindings: [],
      },
      {} as never
    );

    expect(result.summary).toEqual({ high: 2 });
  });

  it("returns an empty report when no findings are provided", async () => {
    const result = await generateSecurityReportSkill.execute({}, {} as never);
    expect(result.total).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.markdown).toContain("## Security Report");
  });
});
