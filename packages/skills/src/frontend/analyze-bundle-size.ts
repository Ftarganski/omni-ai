import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  cwd: z.string().default(".").describe("Target project root directory"),
  metafilePath: z
    .string()
    .default("meta.json")
    .describe("Path (relative to cwd) of the esbuild-shaped metafile to read"),
  command: z
    .string()
    .optional()
    .describe("Optional bundler command to run before reading the metafile (must produce it at metafilePath)"),
  topN: z.number().int().positive().default(10).describe("Number of largest outputs to report"),
});

export type AnalyzeBundleSizeInput = z.infer<typeof InputSchema>;

export interface BundleEntry {
  path: string;
  bytes: number;
  pctOfTotal: number;
}

export interface BundleSizeAnalysis {
  totalBytes: number;
  entries: BundleEntry[];
}

interface EsbuildMetafile {
  outputs?: Record<string, { bytes: number }>;
}

function runCommand(command: string, cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, { cwd, shell: true });
    proc.on("close", () => resolvePromise());
    proc.on("error", reject);
  });
}

export function analyzeMetafile(raw: string, topN: number): BundleSizeAnalysis {
  const metafile = JSON.parse(raw) as EsbuildMetafile;
  const outputs = Object.entries(metafile.outputs ?? {})
    .filter(([path]) => !path.endsWith(".map"))
    .map(([path, output]) => ({ path, bytes: output.bytes }));

  const totalBytes = outputs.reduce((sum, o) => sum + o.bytes, 0);
  const entries = outputs
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, topN)
    .map((o) => ({ ...o, pctOfTotal: totalBytes === 0 ? 0 : o.bytes / totalBytes }));

  return { totalBytes, entries };
}

export const analyzeBundleSizeSkill: ISkill<AnalyzeBundleSizeInput, BundleSizeAnalysis> = {
  name: "analyze-bundle-size",
  description:
    "Read a bundler-generated metafile (esbuild --metafile shape: { outputs: { [file]: { bytes } } } — Vite/Rollup " +
    "builds can emit or be converted to the same shape) and report the largest output contributors. " +
    "Optionally runs a build command first. Use this to suggest code-splitting for the biggest bundle offenders.",

  async execute(input: AnalyzeBundleSizeInput): Promise<BundleSizeAnalysis> {
    const { cwd, metafilePath, command, topN } = InputSchema.parse(input);
    const dir = resolve(cwd);

    if (command) {
      await runCommand(command, dir);
    }

    const raw = await readFile(join(dir, metafilePath), "utf-8");
    return analyzeMetafile(raw, topN);
  },
};
