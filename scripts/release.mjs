#!/usr/bin/env node
/**
 * Usage:
 *   pnpm release          — incrementa patch  (0.1.0 → 0.1.1)
 *   pnpm release patch    — incrementa patch  (0.1.0 → 0.1.1)
 *   pnpm release minor    — incrementa minor  (0.1.0 → 0.2.0)
 *   pnpm release major    — incrementa major  (0.1.0 → 1.0.0)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const bump = process.argv[2] ?? "patch";

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Erro: argumento inválido '${bump}'.`);
  console.error("Uso: pnpm release [patch|minor|major]");
  process.exit(1);
}

// Read current version
const pkgPath = "packages/omni-ai/package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const next =
  bump === "major" ? `${major + 1}.0.0`
  : bump === "minor" ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;

const tag = `v${next}`;

// Check clean working tree
const dirty = execSync("git status --porcelain").toString().trim();
if (dirty) {
  console.error("Erro: há mudanças não commitadas.");
  console.error("Faça commit ou stash antes de criar uma release.");
  process.exit(1);
}

// Pull latest if branch has a remote tracking ref
try {
  execSync("git rev-parse --abbrev-ref @{u}", { stdio: "pipe" });
  execSync("git pull --ff-only", { stdio: "inherit" });
} catch { /* no upstream configured — skip pull */ }

// Bump version in package.json (ephemeral — not committed back)
const prev = pkg.version;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`\n  ${prev} → ${next}\n`);

// Create and push tag
execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });

// Create GitHub Release
execSync(
  `gh release create ${tag} --title "${tag}" --generate-notes`,
  { stdio: "inherit" }
);

console.log(`\n✓ Release ${tag} criada — npm publish iniciará automaticamente\n`);
