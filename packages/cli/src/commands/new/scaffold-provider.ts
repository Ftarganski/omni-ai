import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import { generateProviderFiles } from "./templates.js";

export { generateProviderFiles };

export interface ProviderScaffoldParams {
  kebabName: string;
  displayName: string;
  hasVision: boolean;
  hasEmbedding: boolean;
}

export async function writeProviderFiles(params: ProviderScaffoldParams, providersDir: string): Promise<string> {
  const dir = resolve(process.cwd(), providersDir, `provider-${params.kebabName}`, "src");
  const packageDir = resolve(process.cwd(), providersDir, `provider-${params.kebabName}`);
  const { indexTs, packageJson, tsconfigJson } = generateProviderFiles(params);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.ts"), indexTs, "utf-8");
  await writeFile(join(packageDir, "package.json"), packageJson, "utf-8");
  await writeFile(join(packageDir, "tsconfig.json"), tsconfigJson, "utf-8");
  return packageDir;
}

export async function providerWizard(providersDir: string): Promise<void> {
  console.log();

  const kebabName = await input({
    message: "Nome do provider (kebab-case, ex: mistral, groq, bedrock):",
    validate: (v) => /^[a-z][a-z0-9-]*$/.test(v.trim()) || "Use letras minúsculas, números e hífens",
  });

  const displayName = await input({
    message: "Nome de exibição (ex: Mistral AI, Groq):",
    default: kebabName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    validate: (v) => v.trim().length > 0 || "Nome não pode ser vazio",
  });

  const hasVision = await confirm({ message: "Suporta visão (imagens)?", default: false });
  const hasEmbedding = await confirm({ message: "Suporta embeddings?", default: false });

  const outDir = resolve(process.cwd(), providersDir, `provider-${kebabName}`);
  console.log();
  console.log(chalk.dim(`  Destino: ${outDir}/`));

  let shouldWrite = true;
  try {
    await access(outDir);
    shouldWrite = await confirm({
      message: chalk.yellow(`packages/provider-${kebabName}/ já existe. Sobrescrever arquivos?`),
      default: false,
    });
  } catch {
    // directory doesn't exist — proceed
  }

  if (!shouldWrite) {
    console.log(chalk.dim("\n  Operação cancelada.\n"));
    return;
  }

  const packageDir = await writeProviderFiles({ kebabName, displayName, hasVision, hasEmbedding }, providersDir);
  console.log();
  console.log(`${chalk.green("  ✓")} Provider criado: ${chalk.cyan(`${packageDir}/`)}`);
  console.log(chalk.dim("  Próximos passos:"));
  console.log(chalk.dim(`    1. Implemente complete() em src/index.ts`));
  console.log(
    chalk.dim(`    2. Adicione à raiz tsconfig.json → references: { path: "./${providersDir}/provider-${kebabName}" }`)
  );
  console.log(
    chalk.dim(`    3. Importe em packages/cli/src/commands/run.ts: import "@omni-ai/provider-${kebabName}";`)
  );
  console.log(chalk.dim(`    4. Adicione a chave de API ao .env.example`));
  console.log();
}
