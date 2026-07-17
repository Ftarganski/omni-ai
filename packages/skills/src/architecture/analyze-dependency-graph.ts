import { readdir, readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  directory: z.string().describe("Root directory of the monorepo/package to map"),
  extensions: z.array(z.string()).default([".ts", ".tsx"]).describe("Source file extensions to include"),
  couplingThreshold: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Internal import out-degree above which a file is flagged as excessively coupled"),
});

export type AnalyzeDependencyGraphInput = z.infer<typeof InputSchema>;

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface CouplingFinding {
  file: string;
  outDegree: number;
}

export interface DependencyGraphAnalysis {
  edges: DependencyEdge[];
  excessiveCoupling: CouplingFinding[];
  cycles: string[][];
}

async function collectFiles(dir: string, exts: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, exts)));
    } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e)) && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractRelativeImports(content: string): string[] {
  const fromImports = [...content.matchAll(/from\s+["'](\.[^"']+)["']/g)].map((m) => m[1]);
  const sideEffectImports = [...content.matchAll(/import\s+["'](\.[^"']+)["']/g)].map((m) => m[1]);
  return [...new Set([...fromImports, ...sideEffectImports])];
}

function resolveSpecifier(fromFile: string, specifier: string, allFiles: Set<string>): string | null {
  const base = normalize(join(dirname(fromFile), specifier));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((c) => allFiles.has(c)) ?? null;
}

async function buildGraph(directory: string, extensions: string[]): Promise<Map<string, Set<string>>> {
  const files = await collectFiles(directory, extensions);
  const allFiles = new Set(files);
  const graph = new Map<string, Set<string>>();

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const targets = new Set<string>();
    for (const specifier of extractRelativeImports(content)) {
      const resolved = resolveSpecifier(file, specifier, allFiles);
      if (resolved && resolved !== file) targets.add(resolved);
    }
    graph.set(file, targets);
  }

  return graph;
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const color = new Map<string, "gray" | "black">();
  const path: string[] = [];
  const cycles: string[][] = [];

  function dfs(node: string): void {
    color.set(node, "gray");
    path.push(node);

    for (const next of graph.get(node) ?? []) {
      if (color.get(next) === "gray") {
        const idx = path.indexOf(next);
        cycles.push([...path.slice(idx), next]);
      } else if (color.get(next) !== "black") {
        dfs(next);
      }
    }

    path.pop();
    color.set(node, "black");
  }

  for (const node of graph.keys()) {
    if (!color.has(node)) dfs(node);
  }

  return cycles;
}

export const analyzeDependencyGraphSkill: ISkill<AnalyzeDependencyGraphInput, DependencyGraphAnalysis> = {
  name: "analyze-dependency-graph",
  description:
    "Map the dependency graph between modules/packages of a monorepo by resolving relative imports, then flag " +
    "files with excessive outgoing coupling and circular dependency chains. Use this before a large refactor or " +
    "as part of an architecture review.",

  async execute(input: AnalyzeDependencyGraphInput): Promise<DependencyGraphAnalysis> {
    const { directory, extensions, couplingThreshold } = InputSchema.parse(input);
    const graph = await buildGraph(directory, extensions);

    const edges: DependencyEdge[] = [];
    const excessiveCoupling: CouplingFinding[] = [];
    for (const [from, targets] of graph) {
      for (const to of targets) edges.push({ from, to });
      if (targets.size > couplingThreshold) excessiveCoupling.push({ file: from, outDegree: targets.size });
    }

    return { edges, excessiveCoupling, cycles: findCycles(graph) };
  },
};
