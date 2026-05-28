#!/usr/bin/env node
/**
 * Usage: pnpm release <version>
 *   e.g. pnpm release 0.2.0
 *        pnpm release 0.2.0-beta.1
 *
 * Requires a clean working tree on the main branch.
 * Creates a git tag and a GitHub Release, which triggers the publish workflow.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("Erro: versão inválida.");
  console.error("Uso: pnpm release <versão>  ex: pnpm release 0.2.0");
  process.exit(1);
}

const tag = `v${version}`;

// Check for clean working tree
const dirty = execSync("git status --porcelain").toString().trim();
if (dirty) {
  console.error("Erro: há mudanças não commitadas.");
  console.error("Faça commit ou stash antes de criar uma release.");
  process.exit(1);
}

// Check we're on main
const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
if (branch !== "main" && branch !== "master") {
  console.error(`Erro: você está na branch '${branch}'.`);
  console.error("Faça checkout do main antes de criar uma release.");
  process.exit(1);
}

// Pull latest
execSync("git pull --ff-only", { stdio: "inherit" });

// Bump packages/omni-ai/package.json
const pkgPath = "packages/omni-ai/package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const prev = pkg.version;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`\n  ${prev} → ${version}\n`);

// Create and push tag (package.json bump is ephemeral — not committed)
execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });

// Create GitHub Release (publishes immediately, triggering the npm publish workflow)
execSync(
  `gh release create ${tag} --title "${tag}" --generate-notes`,
  { stdio: "inherit" }
);

console.log(`\n✓ Release ${tag} criada — npm publish iniciará automaticamente\n`);
