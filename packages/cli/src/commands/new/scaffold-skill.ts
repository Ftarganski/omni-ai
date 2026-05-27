import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { generateSkillTs } from "./templates.js";

export { generateSkillTs };

const DOMAINS = ["backend", "frontend", "qa", "fs", "git", "http", "multimodal", "ux"] as const;

export interface SkillScaffoldParams {
  domain: string;
  kebabName: string;
  description: string;
}

export async function writeSkillFile(params: SkillScaffoldParams, skillsDir: string): Promise<string> {
  const dir = resolve(process.cwd(), skillsDir, params.domain);
  const filePath = join(dir, `${params.kebabName}.ts`);
  const content = generateSkillTs({ kebabName: params.kebabName, description: params.description });
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function skillWizard(skillsDir: string): Promise<void> {
  console.log();

  const domain = await select({
    message: "Domínio da skill:",
    choices: DOMAINS.map((d) => ({ value: d, name: d })),
  });

  const kebabName = await input({
    message: "Nome da skill (kebab-case, ex: analyze-orders):",
    validate: (v) => /^[a-z][a-z0-9-]*$/.test(v.trim()) || "Use letras minúsculas, números e hífens",
  });

  const description = await input({
    message: "Descrição (usada pelo agente para decidir quando chamar esta skill):",
    validate: (v) => v.trim().length > 0 || "Descrição não pode ser vazia",
  });

  const outPath = resolve(process.cwd(), skillsDir, domain, `${kebabName}.ts`);
  console.log();
  console.log(chalk.dim(`  Destino: ${outPath}`));

  let shouldWrite = true;
  try {
    await access(outPath);
    shouldWrite = await confirm({ message: chalk.yellow("Arquivo já existe. Sobrescrever?"), default: false });
  } catch {
    // file doesn't exist — proceed
  }

  if (!shouldWrite) {
    console.log(chalk.dim("\n  Operação cancelada.\n"));
    return;
  }

  const filePath = await writeSkillFile({ domain, kebabName, description }, skillsDir);
  console.log();
  console.log(`${chalk.green("  ✓")} Skill criada: ${chalk.cyan(filePath)}`);
  console.log(chalk.dim(`  Próximos passos:`));
  console.log(chalk.dim(`    1. Implemente a lógica em execute()`));
  console.log(chalk.dim(`    2. Exporte de ${skillsDir}/${domain}/index.ts`));
  console.log(chalk.dim(`    3. Registre em packages/cli/src/commands/run.ts`));
  console.log();
}
