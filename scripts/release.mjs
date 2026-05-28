#!/usr/bin/env node
/**
 * Usage:
 *   pnpm release          — incrementa patch  (1.0.0 → 1.0.1)
 *   pnpm release patch    — incrementa patch  (1.0.0 → 1.0.1)
 *   pnpm release minor    — incrementa minor  (1.0.0 → 1.1.0)
 *   pnpm release major    — incrementa major  (1.0.0 → 2.0.0)
 *
 * Cria branch sdk/X.X.X, commita o bump de versão e abre PR para main.
 * A publicação no npm ocorre automaticamente ao mergear a PR.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const bump = process.argv[2] ?? "patch";

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Erro: argumento inválido '${bump}'.`);
  console.error("Uso: pnpm release [patch|minor|major]");
  process.exit(1);
}

const pkgPath = "bundle/omni-ai/package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const next =
  bump === "major" ? `${major + 1}.0.0`
  : bump === "minor" ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;

const branch = `release/${next}`;

// Garante working tree limpa
const dirty = execSync("git status --porcelain").toString().trim();
if (dirty) {
  console.error("Erro: há mudanças não commitadas.");
  console.error("Faça commit ou stash antes de criar uma release.");
  process.exit(1);
}

// Atualiza main antes de criar o branch
try {
  execSync("git rev-parse --abbrev-ref @{u}", { stdio: "pipe" });
  execSync("git pull --ff-only", { stdio: "inherit" });
} catch { /* sem upstream configurado — ignora */ }

// Bump de versão
const prev = pkg.version;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`\n  ${prev} → ${next}\n`);

// Cria branch, commita e envia
execSync(`git checkout -b ${branch}`, { stdio: "inherit" });
execSync(`git add ${pkgPath}`, { stdio: "inherit" });
execSync(`git commit -m "release: bump version to ${next}"`, { stdio: "inherit" });
execSync(`git push origin ${branch}`, { stdio: "inherit" });

// Abre PR para main
execSync(
  `gh pr create --title "release/${next}" --base main --body "## Release ${next}\n\nAo mergear esta PR, o pacote \`@ftarganski/omni-ai@${next}\` será publicado automaticamente no npm."`,
  { stdio: "inherit" }
);

// Volta para o branch anterior
execSync("git checkout -", { stdio: "inherit" });

console.log(`\n✓ PR release/${next} criada — a publicação no npm ocorrerá ao mergear.\n`);
