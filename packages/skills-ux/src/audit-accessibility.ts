import type { ISkill } from "@omni-ai/core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const InputSchema = z.object({
  path: z
    .string()
    .describe("File path (.tsx/.ts) or directory to audit recursively"),
  recursive: z
    .boolean()
    .default(false)
    .describe("Scan all .tsx files in the directory recursively"),
});

type Input = z.infer<typeof InputSchema>;

export type IssueSeverity = "critical" | "moderate" | "low";

export interface A11yIssue {
  file: string;
  line: number;
  severity: IssueSeverity;
  rule: string;
  description: string;
  suggestion: string;
  snippet: string;
}

interface HeuristicRule {
  id: string;
  severity: IssueSeverity;
  description: string;
  suggestion: string;
  pattern: RegExp;
  /** Return true when the match IS an issue (some patterns need negative lookahead logic) */
  isIssue?: (match: RegExpExecArray, line: string, allLines: string[], lineIndex: number) => boolean;
}

const RULES: HeuristicRule[] = [
  {
    id: "img-missing-alt",
    severity: "critical",
    description: "<img> without alt attribute — screen readers will read the file name",
    suggestion: 'Add alt="" for decorative images or alt="descriptive text" for informative ones',
    pattern: /<img(?![^>]*\balt=)[^>]*/,
  },
  {
    id: "onclick-non-interactive",
    severity: "critical",
    description: "onClick on a non-interactive element (div/span/p) without role or tabIndex",
    suggestion: 'Use <button> instead, or add role="button" tabIndex={0} onKeyDown handler',
    pattern: /<(div|span|p|section|article)\s[^>]*onClick/,
    isIssue: (_match, line) =>
      !/role=["']button["']/.test(line) && !/tabIndex/.test(line),
  },
  {
    id: "link-blank-no-rel",
    severity: "moderate",
    description: 'target="_blank" without rel="noopener noreferrer" — security risk and unexpected UX',
    suggestion: 'Add rel="noopener noreferrer" to all target="_blank" links',
    pattern: /target=["']_blank["']/,
    isIssue: (_match, line) => !/rel=/.test(line),
  },
  {
    id: "hardcoded-color",
    severity: "moderate",
    description: "Hardcoded Tailwind color scale class — will break dark mode and theme consistency",
    suggestion:
      "Replace with shadcn/ui semantic tokens: bg-background, text-foreground, bg-muted, text-muted-foreground, border-border",
    pattern:
      /className=[^>]*["'][^"']*\b(bg|text|border|ring|outline|fill|stroke)-(white|black|gray|zinc|slate|stone|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+[^"']*["']/,
  },
  {
    id: "icon-button-no-label",
    severity: "critical",
    description: "Button containing only an icon without aria-label — invisible to screen readers",
    suggestion: 'Add aria-label="Descriptive action name" to the button',
    pattern: /<button(?![^>]*aria-label)[^>]*>\s*<[A-Z][a-zA-Z]+\s*(?:size|className|strokeWidth)[^/]*\/>\s*<\/button>/,
  },
  {
    id: "input-missing-label",
    severity: "critical",
    description: "<input> or <Input> without aria-label, aria-labelledby, or associated <label>",
    suggestion:
      "Wrap with Form.Item + Form.Label, or add aria-label directly to the input",
    pattern: /<(?:input|Input)\s(?![^>]*(?:aria-label|aria-labelledby|id=))[^>]*/,
    isIssue: (_match, _line, allLines, lineIndex) => {
      const context = allLines.slice(Math.max(0, lineIndex - 5), lineIndex + 5).join("\n");
      return !/<label|Form\.Label|htmlFor/.test(context);
    },
  },
  {
    id: "autofocus",
    severity: "low",
    description: "autoFocus used — can disorient screen reader users and break keyboard flow",
    suggestion:
      "Manage focus programmatically with useEffect + ref.focus() only when truly needed (e.g. after modal opens)",
    pattern: /\bautoFocus\b/,
  },
  {
    id: "inline-style",
    severity: "low",
    description: "Inline style attribute — bypasses theme system and cannot adapt to dark mode",
    suggestion: "Replace with Tailwind utility classes or shadcn/ui semantic tokens",
    pattern: /\bstyle=\{/,
  },
  {
    id: "no-focus-visible",
    severity: "moderate",
    description: "Interactive element may be missing focus-visible styles",
    suggestion:
      "Ensure focus-visible:ring-2 focus-visible:ring-ring is present on all focusable elements",
    pattern: /<(button|a|input|select|textarea|Input|Button|Link)[^>]*(?:className|class)=["'][^"']*["'][^>]*>/,
    isIssue: (_match, line) =>
      !/focus-visible/.test(line) && !/focus:ring/.test(line),
  },
];

async function auditFile(filePath: string): Promise<A11yIssue[]> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const issues: A11yIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (!match) continue;
      const isIssue = rule.isIssue
        ? rule.isIssue(match, line, lines, i)
        : true;
      if (!isIssue) continue;
      issues.push({
        file: filePath,
        line: i + 1,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        suggestion: rule.suggestion,
        snippet: line.trim().slice(0, 120),
      });
    }
  }

  return issues;
}

const MAX_DEPTH = 10;
const MAX_FILES = 500;

async function collectFiles(
  dir: string,
  recursive: boolean,
  depth = 0,
  results: string[] = []
): Promise<string[]> {
  if (depth > MAX_DEPTH || results.length >= MAX_FILES) return results;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= MAX_FILES) break;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      await collectFiles(full, recursive, depth + 1, results);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
    ) {
      results.push(full);
    }
  }
  return results;
}

export interface AuditReport {
  totalFiles: number;
  totalIssues: number;
  critical: number;
  moderate: number;
  low: number;
  issues: A11yIssue[];
}

export const auditAccessibilitySkill: ISkill<Input, AuditReport> = {
  name: "audit-accessibility",
  description:
    "Heuristic static scan of React TSX files for accessibility and dark-mode issues. Detects: missing alt, onClick on non-interactive elements, icon-only buttons without aria-label, inputs without labels, target=_blank without rel, hardcoded colors, missing focus-visible styles, autoFocus misuse, inline styles.",

  async execute(input: Input): Promise<AuditReport> {
    const { path, recursive } = InputSchema.parse(input);

    let files: string[];
    try {
      const entries = await readdir(path);
      files = await collectFiles(path, recursive ?? false);
      void entries;
    } catch {
      files = [path];
    }

    const allIssues: A11yIssue[] = [];
    for (const file of files) {
      allIssues.push(...(await auditFile(file)));
    }

    const critical = allIssues.filter((i) => i.severity === "critical").length;
    const moderate = allIssues.filter((i) => i.severity === "moderate").length;
    const low = allIssues.filter((i) => i.severity === "low").length;

    return {
      totalFiles: files.length,
      totalIssues: allIssues.length,
      critical,
      moderate,
      low,
      issues: allIssues,
    };
  },
};
