import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { generateAgentYaml } from "./templates.js";

export { generateAgentYaml };

const ALL_SKILLS = [
  // Layer 1 — primitives
  "read-file",
  "write-file",
  "list-directory",
  "search-code",
  "audit-accessibility",
  "git-status",
  "git-diff",
  "git-log",
  "git-commit-message",
  "http-request",
  "analyze-image",
  // Layer 2 — domain readers
  "find-code-pattern",
  "analyze-nestjs-module",
  "analyze-dynamo-schema",
  "analyze-graphql-schema",
  "find-component-pattern",
  "analyze-component",
  "analyze-module-structure",
  "find-test-pattern",
  "analyze-test-coverage",
];

export interface AgentScaffoldParams {
  domain: string;
  role: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

export async function writeAgentFile(params: AgentScaffoldParams, agentsDir: string): Promise<string> {
  const dir = resolve(process.cwd(), agentsDir, params.domain);
  const filePath = join(dir, `${params.domain}-${params.role}.yaml`);
  const content = generateAgentYaml({
    name: `${params.domain}-${params.role}`,
    description: params.description,
    systemPrompt: params.systemPrompt,
    skills: params.skills,
    maxIterations: 10,
    temperature: 0.3,
  });
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function agentWizard(agentsDir: string): Promise<void> {
  console.log();

  const domain = await select({
    message: "Domínio do agente:",
    choices: [
      { value: "backend", name: "backend  — NestJS, DynamoDB, GraphQL" },
      { value: "frontend", name: "frontend — React, hooks, componentes" },
      { value: "ux", name: "ux       — acessibilidade, design system" },
      { value: "qa", name: "qa       — testes, coverage, validação" },
    ],
  });

  const role = await input({
    message: "Role (slug, ex: service, dev, test):",
    validate: (v) => /^[a-z][a-z0-9-]*$/.test(v.trim()) || "Use letras minúsculas, números e hífens",
  });

  const description = await input({
    message: "Descrição (uma linha):",
    validate: (v) => v.trim().length > 0 || "Descrição não pode ser vazia",
  });

  const systemPrompt = await input({
    message: "System prompt (pode editar no arquivo depois):",
    default: `You are a ${domain} developer specialized in ${role} tasks.`,
  });

  const skills = await checkbox({
    message: "Skills disponíveis para este agente:",
    choices: ALL_SKILLS.map((s) => ({ value: s, name: s })),
  });

  const outPath = resolve(process.cwd(), agentsDir, domain, `${domain}-${role}.yaml`);
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

  const filePath = await writeAgentFile({ domain, role, description, systemPrompt, skills }, agentsDir);
  console.log();
  console.log(`${chalk.green("  ✓")} Agente criado: ${chalk.cyan(filePath)}`);
  console.log(chalk.dim("  Adicione ao omni-ai.yaml (seção agents:) ou coloque no agentsDir para uso automático."));
  console.log(chalk.dim(`  Testar: omni run ${domain}-${role} "sua tarefa aqui"`));
  console.log();
}
