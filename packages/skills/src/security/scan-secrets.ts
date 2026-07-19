import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z
  .object({
    content: z.string().optional().describe("Raw text or diff to scan"),
    path: z.string().optional().describe("Path to a file to scan (used when content is omitted)"),
  })
  .refine((data) => data.content !== undefined || data.path !== undefined, {
    message: "Provide either content or path",
  });

export type ScanSecretsInput = z.infer<typeof InputSchema>;

export interface SecretFinding {
  rule: string;
  line: number;
  snippet: string;
}

export interface ScanSecretsResult {
  clean: boolean;
  findings: SecretFinding[];
}

interface Rule {
  name: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "private-key-block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/ },
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  {
    name: "generic-secret-assignment",
    pattern: /\b(?:api[_-]?key|secret|password|token)\b\s*[:=]\s*["']?[A-Za-z0-9_\-/+=]{12,}["']?/i,
  },
  { name: "connection-string-credentials", pattern: /\w+:\/\/[^:/\s]+:[^@/\s]+@/ },
];

function maskSnippet(line: string, match: string): string {
  return line.replace(match, "[REDACTED]").trim();
}

export const scanSecretsSkill: ISkill<ScanSecretsInput, ScanSecretsResult> = {
  name: "scan-secrets",
  description:
    "Scan a text/diff or a file for common credential patterns (AWS keys, private key blocks, GitHub tokens, " +
    "JWTs, generic secret/password assignments, connection strings with embedded credentials) before a commit. " +
    "Findings never include the raw secret value — only a redacted snippet. Reinforces the project's " +
    "no-sensitive-data-in-commits rule.",

  async execute(input: ScanSecretsInput): Promise<ScanSecretsResult> {
    const { content, path } = InputSchema.parse(input);
    const source = content ?? (await readFile(resolve(path as string), "utf-8"));
    const lines = source.split("\n");

    const findings: SecretFinding[] = [];
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        const match = rule.pattern.exec(line);
        if (match) {
          findings.push({ rule: rule.name, line: index + 1, snippet: maskSnippet(line, match[0]) });
        }
      }
    });

    return { clean: findings.length === 0, findings };
  },
};
