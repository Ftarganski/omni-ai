import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to the migration file (.sql or .ts)"),
});

export type AnalyzeMigrationSafetyInput = z.infer<typeof InputSchema>;

export type MigrationSeverity = "high" | "medium";

export interface MigrationFinding {
  rule: string;
  severity: MigrationSeverity;
  line: number;
  snippet: string;
  message: string;
}

export interface MigrationSafetyAnalysis {
  path: string;
  safe: boolean;
  findings: MigrationFinding[];
}

interface Rule {
  name: string;
  severity: MigrationSeverity;
  pattern: RegExp;
  message: string;
  /** Skip the match when this pattern is also present on the same line (e.g. a mitigating clause). */
  exceptIf?: RegExp;
}

const RULES: Rule[] = [
  {
    name: "drop-table",
    severity: "high",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "DROP TABLE is irreversible — ensure a verified backup/rollback plan exists before running this.",
  },
  {
    name: "drop-column",
    severity: "high",
    pattern: /\bDROP\s+COLUMN\b/i,
    message:
      "DROP COLUMN permanently discards data — confirm the column is unused and consider a soft-deprecation step first.",
  },
  {
    name: "truncate",
    severity: "high",
    pattern: /\bTRUNCATE\b/i,
    message:
      "TRUNCATE irreversibly deletes all rows — verify this is intentional and not running against production data.",
  },
  {
    name: "alter-column-type",
    severity: "high",
    pattern: /\bALTER\s+(?:TABLE\s+\w+\s+)?(?:ALTER|MODIFY)\s+COLUMN\b.*\bTYPE\b/i,
    message: "Changing a column's type triggers a full table rewrite and locks the table on large datasets.",
  },
  {
    name: "add-column-not-null-no-default",
    severity: "medium",
    pattern: /\bADD\s+COLUMN\b(?![^;]*\bDEFAULT\b)[^;]*\bNOT\s+NULL\b/i,
    message: "Adding a NOT NULL column without a DEFAULT forces a blocking table rewrite on large tables.",
  },
  {
    name: "create-index-blocking",
    severity: "medium",
    pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
    exceptIf: /\bCONCURRENTLY\b/i,
    message: "CREATE INDEX without CONCURRENTLY locks the table for writes — safe only for small tables.",
  },
  {
    name: "rename-column-or-table",
    severity: "medium",
    pattern: /\bRENAME\s+(?:COLUMN|TABLE)\b/i,
    message: "Renaming a column/table is a breaking change for in-flight code — requires a coordinated deploy.",
  },
];

export const analyzeMigrationSafetySkill: ISkill<AnalyzeMigrationSafetyInput, MigrationSafetyAnalysis> = {
  name: "analyze-migration-safety",
  description:
    "Statically scan a database migration (SQL or ORM) for blocking or irreversible operations on large tables — " +
    "dropped tables/columns, truncates, type changes, non-concurrent index creation, NOT NULL columns without a " +
    "default, and renames. Use this before merging a migration to catch operations that could lock production tables.",

  async execute(input: AnalyzeMigrationSafetyInput): Promise<MigrationSafetyAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    const lines = source.split("\n");

    const findings: MigrationFinding[] = [];
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line) && !rule.exceptIf?.test(line)) {
          findings.push({
            rule: rule.name,
            severity: rule.severity,
            line: index + 1,
            snippet: line.trim(),
            message: rule.message,
          });
        }
      }
    });

    return {
      path,
      safe: !findings.some((f) => f.severity === "high"),
      findings,
    };
  },
};
