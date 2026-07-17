import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z
  .object({
    content: z.string().optional().describe("Raw source/diff text to scan"),
    path: z.string().optional().describe("Path to a file to scan (used when content is omitted)"),
  })
  .refine((data) => data.content !== undefined || data.path !== undefined, {
    message: "Provide either content or path",
  });

export type ScanOwaspPatternsInput = z.infer<typeof InputSchema>;

export type OwaspSeverity = "high" | "medium";

export interface OwaspFinding {
  rule: string;
  category: string;
  severity: OwaspSeverity;
  line: number;
  snippet: string;
  message: string;
}

export interface ScanOwaspPatternsResult {
  clean: boolean;
  findings: OwaspFinding[];
}

interface Rule {
  name: string;
  category: string;
  severity: OwaspSeverity;
  pattern: RegExp;
  message: string;
}

const DYNAMIC_ARG = /(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+|[a-zA-Z_$][\w.]*\s*\+)/;

const RULES: Rule[] = [
  {
    name: "sql-injection",
    category: "A03:2021-Injection",
    severity: "high",
    pattern: new RegExp(`\\b(?:query|execute)\\s*\\(\\s*${DYNAMIC_ARG.source}`),
    message:
      "Building a SQL query with string concatenation/interpolation risks SQL injection — use parameterized queries.",
  },
  {
    name: "xss-dangerous-html",
    category: "A03:2021-Injection",
    severity: "high",
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/,
    message: "Assigning raw HTML risks XSS — sanitize the content or avoid injecting raw HTML.",
  },
  {
    name: "command-injection",
    category: "A03:2021-Injection",
    severity: "high",
    pattern: new RegExp(`\\b(?:exec|execSync)\\s*\\(\\s*${DYNAMIC_ARG.source}`),
    message:
      "Passing dynamic input to a shell command risks command injection — use execFile/spawn with an argument array.",
  },
  {
    name: "dynamic-code-execution",
    category: "A03:2021-Injection",
    severity: "high",
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    message:
      "Dynamic code execution (eval/Function) is a common injection vector — avoid evaluating dynamic strings as code.",
  },
  {
    name: "ssrf-dynamic-url",
    category: "A10:2021-Server-Side Request Forgery",
    severity: "medium",
    pattern: new RegExp(`\\b(?:fetch|axios(?:\\.\\w+)?)\\s*\\(\\s*${DYNAMIC_ARG.source}`),
    message: "Making a request to a dynamically-built URL risks SSRF — validate/allowlist the target host.",
  },
  {
    name: "path-traversal",
    category: "A01:2021-Broken Access Control",
    severity: "medium",
    pattern: new RegExp(`\\breadFile(?:Sync)?\\s*\\(\\s*${DYNAMIC_ARG.source}`),
    message:
      "Reading a file at a dynamically-built path risks path traversal — validate/resolve within an allowed root.",
  },
  {
    name: "hardcoded-credential-check",
    category: "A07:2021-Identification and Authentication Failures",
    severity: "high",
    pattern: /\bpassword\s*===?\s*['"][^'"]+['"]/i,
    message:
      "Comparing a password against a hardcoded literal — use a constant-time hash comparison, never a literal secret.",
  },
];

export const scanOwaspPatternsSkill: ISkill<ScanOwaspPatternsInput, ScanOwaspPatternsResult> = {
  name: "scan-owasp-patterns",
  description:
    "Statically scan a file/diff for common OWASP Top 10 vulnerability patterns: SQL injection, XSS via raw HTML " +
    "assignment, command injection, dynamic code execution, SSRF, path traversal, and hardcoded credential " +
    "checks. Use this during code review to catch high-risk patterns before merge.",

  async execute(input: ScanOwaspPatternsInput): Promise<ScanOwaspPatternsResult> {
    const { content, path } = InputSchema.parse(input);
    const source = content ?? (await readFile(resolve(path as string), "utf-8"));
    const lines = source.split("\n");

    const findings: OwaspFinding[] = [];
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          findings.push({
            rule: rule.name,
            category: rule.category,
            severity: rule.severity,
            line: index + 1,
            snippet: line.trim(),
            message: rule.message,
          });
        }
      }
    });

    return { clean: findings.length === 0, findings };
  },
};
