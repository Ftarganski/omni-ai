import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const InputSchema = z.object({
  path: z.string().describe("Path to a CI workflow file (e.g. .github/workflows/ci.yml)"),
});

export type AnalyzeCiConfigInput = z.infer<typeof InputSchema>;

export interface CiConfigGap {
  rule: string;
  job: string;
  message: string;
}

export interface CiConfigAnalysis {
  path: string;
  gaps: CiConfigGap[];
}

interface WorkflowStep {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  "timeout-minutes"?: number;
  steps?: WorkflowStep[];
}

interface WorkflowDocument {
  jobs?: Record<string, WorkflowJob>;
}

const CACHE_AWARE_ACTIONS = ["actions/setup-node", "actions/setup-python", "actions/setup-go"];

function hasCacheStep(steps: WorkflowStep[]): boolean {
  return steps.some((step) => {
    if (step.uses?.startsWith("actions/cache")) return true;
    if (step.uses && CACHE_AWARE_ACTIONS.some((a) => step.uses?.startsWith(a)) && step.with?.cache) return true;
    return false;
  });
}

function findDuplicateSteps(steps: WorkflowStep[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const step of steps) {
    if (!step.run) continue;
    if (seen.has(step.run)) duplicates.add(step.run);
    seen.add(step.run);
  }
  return [...duplicates];
}

export function analyzeWorkflow(source: string): CiConfigGap[] {
  const doc = parseYaml(source) as WorkflowDocument;
  const gaps: CiConfigGap[] = [];

  for (const [jobName, job] of Object.entries(doc.jobs ?? {})) {
    const steps = job.steps ?? [];

    if (job["timeout-minutes"] === undefined) {
      gaps.push({ rule: "missing-timeout", job: jobName, message: `Job "${jobName}" has no timeout-minutes set.` });
    }

    if (!hasCacheStep(steps)) {
      gaps.push({
        rule: "missing-cache",
        job: jobName,
        message: `Job "${jobName}" has no dependency cache step (actions/cache or setup-*'s cache option).`,
      });
    }

    for (const duplicateRun of findDuplicateSteps(steps)) {
      gaps.push({
        rule: "duplicate-step",
        job: jobName,
        message: `Job "${jobName}" runs the same command more than once: "${duplicateRun}".`,
      });
    }
  }

  return gaps;
}

export const analyzeCiConfigSkill: ISkill<AnalyzeCiConfigInput, CiConfigAnalysis> = {
  name: "analyze-ci-config",
  description:
    "Parse a CI workflow file (e.g. GitHub Actions) and flag common gaps: jobs without a timeout-minutes, jobs " +
    "without a dependency cache step, and duplicated run commands within the same job. " +
    "Use this to review CI configuration changes before merge.",

  async execute(input: AnalyzeCiConfigInput): Promise<CiConfigAnalysis> {
    const { path } = InputSchema.parse(input);
    const source = await readFile(resolve(path), "utf-8");
    return { path, gaps: analyzeWorkflow(source) };
  },
};
