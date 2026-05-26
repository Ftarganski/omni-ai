import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import chalk from "chalk";

// ── Path helpers ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = packages/cli/dist/commands/ → 4 levels up = omni-ai root
const OMNI_ROOT = resolve(__dirname, "..", "..", "..", "..");
const CONFIG_PATH = resolve(OMNI_ROOT, "config", "omni-ai.yaml");
const ENV_PATH = resolve(OMNI_ROOT, ".env");

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ── .env helpers ─────────────────────────────────────────────────────────────

async function readEnvFile(path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const content = await readFile(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
    }
  } catch {
    // file doesn't exist yet — start empty
  }
  return map;
}

function buildEnvFile(entries: Map<string, string>, template: string): string {
  // Keep the template structure (comments, blank lines) and replace/add values
  const lines = template.split("\n");
  const written = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq !== -1) {
        const key = trimmed.slice(0, eq).trim();
        const value = entries.get(key) ?? "";
        result.push(`${key}=${value}`);
        written.add(key);
        continue;
      }
    }
    result.push(line);
  }

  // Append any new keys not in the template
  for (const [key, value] of entries) {
    if (!written.has(key)) {
      result.push(`${key}=${value}`);
    }
  }

  return result.join("\n");
}

// ── omni-ai.yaml builder ──────────────────────────────────────────────────────

interface ProviderConfig {
  name: string;
  type: string;
  envKey: string;
  envValue: string;
  defaultModel: string;
  baseUrl?: string;
}

function buildYaml(primary: ProviderConfig, extras: ProviderConfig[]): string {
  const allProviders = [primary, ...extras];

  const providerBlocks = allProviders
    .map((p) => {
      const lines = [`  - name: ${p.name}`, `    type: ${p.type}`, `    apiKey: \${${p.envKey}}`];
      if (p.baseUrl) lines.push(`    baseUrl: ${p.baseUrl}`);
      lines.push(`    defaultModel: ${p.defaultModel}`);
      return lines.join("\n");
    })
    .join("\n\n");

  return `version: "1"

# Provider padrão — todos os agentes herdam este, a menos que declarem o próprio
defaultProvider: ${primary.name}

# Diretório dos YAML de agentes (relativo à raiz do repositório)
agentsDir: agents

providers:
${providerBlocks}

# ── Herança de provider/modelo ────────────────────────────────────────────────
# agent.provider ausente  →  usa defaultProvider acima
# agent.model ausente     →  usa defaultModel do provider resolvido
# agent.provider presente →  sobrescreve só para aquele agente
# agent.model presente    →  sobrescreve o modelo só para aquele agente
# ─────────────────────────────────────────────────────────────────────────────

agents:
  # Agente inline de exemplo — não precisa de arquivo YAML separado
  - name: code-reviewer
    description: Revisa código para qualidade, bugs e problemas de segurança
    systemPrompt: |
      Você é um revisor de código especialista. Analise o código fornecido e
      dê feedback acionável sobre qualidade, possíveis bugs, vulnerabilidades
      de segurança e problemas de performance. Seja preciso e objetivo.
    skills:
      - read-file
      - search-code
    maxIterations: 5
    temperature: 0.1
`;
}

// ── Provider setup flows ──────────────────────────────────────────────────────

async function setupCopilot(): Promise<ProviderConfig> {
  console.log();
  console.log(chalk.dim("  Para obter seu token GitHub:"));
  console.log(chalk.dim("    gh auth login    # se ainda não fez"));
  console.log(chalk.dim("    gh auth token    # mostra o token atual"));
  console.log();

  const token = await password({
    message: "Cole seu GitHub token (ghp_... ou github_pat_...):",
    validate: (v) => v.trim().length > 0 || "Token não pode ser vazio",
  });

  const model = await select({
    message: "Modelo padrão:",
    choices: [
      { name: "gpt-4o  (recomendado)", value: "gpt-4o" },
      { name: "gpt-4o-mini  (rápido, custo baixo)", value: "gpt-4o-mini" },
      { name: "o1", value: "o1" },
    ],
  });

  return {
    name: "copilot",
    type: "copilot",
    envKey: "GITHUB_TOKEN",
    envValue: token.trim(),
    defaultModel: model,
    baseUrl: "https://api.githubcopilot.com",
  };
}

async function setupAnthropic(): Promise<ProviderConfig> {
  console.log();
  console.log(chalk.dim("  Como obter: https://console.anthropic.com → API Keys → Create key"));
  console.log(chalk.dim("  Formato: sk-ant-api03-..."));
  console.log();

  const key = await password({
    message: "Cole sua Anthropic API key:",
    validate: (v) => v.trim().length > 0 || "API key não pode ser vazia",
  });

  const model = await select({
    message: "Modelo padrão:",
    choices: [
      { name: "claude-sonnet-4-6  (recomendado — qualidade/velocidade balanceados)", value: "claude-sonnet-4-6" },
      { name: "claude-opus-4-7  (raciocínio complexo, contexto longo)", value: "claude-opus-4-7" },
      { name: "claude-haiku-4-5-20251001  (rápido, custo baixo)", value: "claude-haiku-4-5-20251001" },
    ],
  });

  return {
    name: "anthropic",
    type: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    envValue: key.trim(),
    defaultModel: model,
  };
}

async function setupOpenAI(): Promise<ProviderConfig> {
  console.log();
  console.log(chalk.dim("  Como obter: https://platform.openai.com → API keys → Create new secret key"));
  console.log(chalk.dim("  Formato: sk-proj-... (novo) ou sk-... (legado)"));
  console.log();

  const key = await password({
    message: "Cole sua OpenAI API key:",
    validate: (v) => v.trim().length > 0 || "API key não pode ser vazia",
  });

  const model = await select({
    message: "Modelo padrão:",
    choices: [
      { name: "gpt-4o  (recomendado — multimodal, raciocínio forte)", value: "gpt-4o" },
      { name: "gpt-4o-mini  (rápido, custo eficiente)", value: "gpt-4o-mini" },
      { name: "o1", value: "o1" },
      { name: "o3-mini", value: "o3-mini" },
    ],
  });

  return {
    name: "openai",
    type: "openai",
    envKey: "OPENAI_API_KEY",
    envValue: key.trim(),
    defaultModel: model,
  };
}

async function setupCustom(): Promise<ProviderConfig> {
  console.log();
  console.log(chalk.dim("  Compatível com qualquer endpoint OpenAI-like:"));
  console.log(chalk.dim("    Ollama:  http://localhost:11434/v1"));
  console.log(chalk.dim("    Groq:    https://api.groq.com/openai/v1"));
  console.log(chalk.dim("    Azure:   https://<resource>.openai.azure.com"));
  console.log();

  const baseUrl = await input({
    message: "Base URL do endpoint:",
    default: "http://localhost:11434/v1",
    validate: (v) => v.trim().length > 0 || "URL não pode ser vazia",
  });

  const key = await password({
    message: "API key (deixe vazio se não for necessária):",
  });

  const model = await input({
    message: "Modelo padrão:",
    default: "llama3.2",
    validate: (v) => v.trim().length > 0 || "Modelo não pode ser vazio",
  });

  const envKey = "CUSTOM_LLM_API_KEY";
  const envBaseUrl = "CUSTOM_LLM_BASE_URL";

  return {
    name: "custom",
    type: "custom",
    envKey,
    envValue: key.trim(),
    defaultModel: model.trim(),
    baseUrl: `\${${envBaseUrl}}`,
    // we'll handle the base URL separately via a side-effect on envKey
    // store the real base URL in a special field
    ...(baseUrl ? ({ _baseUrlValue: baseUrl } as Record<string, string>) : {}),
  } as ProviderConfig & { _baseUrlValue?: string };
}

async function selectProvider(label: string): Promise<ProviderConfig> {
  const choice = await select({
    message: label,
    choices: [
      { name: "GitHub Copilot  (recomendado — usa seu token GitHub)", value: "copilot" },
      { name: "Anthropic (Claude)", value: "anthropic" },
      { name: "OpenAI (GPT)", value: "openai" },
      { name: "Custom / self-hosted  (Ollama, Groq, Azure...)", value: "custom" },
    ],
  });

  switch (choice) {
    case "copilot":
      return setupCopilot();
    case "anthropic":
      return setupAnthropic();
    case "openai":
      return setupOpenAI();
    default:
      return setupCustom();
  }
}

// ── Main command ──────────────────────────────────────────────────────────────

export async function initCommand(): Promise<void> {
  console.log();
  console.log(chalk.bold("  omni-ai — configuração inicial"));
  console.log(chalk.dim("  Isso vai criar config/omni-ai.yaml e atualizar o .env"));
  console.log();

  // Check if config already exists
  if (await fileExists(CONFIG_PATH)) {
    const overwrite = await confirm({
      message: chalk.yellow("config/omni-ai.yaml já existe. Sobrescrever?"),
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.dim("\n  Operação cancelada.\n"));
      return;
    }
  }

  // Select primary provider
  const primary = await selectProvider("Qual provider de IA usar?");

  // Offer to add a second provider
  const addSecond = await confirm({
    message: "Adicionar um segundo provider (para usar em agentes específicos)?",
    default: false,
  });

  const extras: ProviderConfig[] = [];
  if (addSecond) {
    console.log();
    const second = await selectProvider("Segundo provider:");
    if (second.name !== primary.name) {
      extras.push(second);
    } else {
      console.log(chalk.dim("  Mesmo provider — ignorado."));
    }
  }

  // Which agent sets to mention in the summary
  const agentSets = await checkbox({
    message: "Quais grupos de agentes você vai usar? (informativo — todos já estão disponíveis)",
    choices: [
      { name: "Backend — NestJS, DynamoDB, GraphQL (7 agentes)", value: "backend", checked: true },
      { name: "Frontend — React, TanStack Router, shadcn/ui (5 agentes)", value: "frontend", checked: true },
      { name: "UX — auditoria, forms, states, motion (5 agentes)", value: "ux", checked: true },
      { name: "QA — validação e veredicto de merge (4 agentes)", value: "qa", checked: true },
    ],
  });

  // ── Write files ─────────────────────────────────────────────────────────────

  // Build env entries
  const envEntries = await readEnvFile(ENV_PATH);
  envEntries.set(primary.envKey, primary.envValue);
  for (const extra of extras) {
    envEntries.set(extra.envKey, extra.envValue);
  }

  // Handle custom provider base URL
  const allProviders = [primary, ...extras];
  for (const p of allProviders) {
    const custom = p as ProviderConfig & { _baseUrlValue?: string };
    if (custom._baseUrlValue) {
      envEntries.set("CUSTOM_LLM_BASE_URL", custom._baseUrlValue);
    }
  }

  // Read env template
  const envTemplatePath = resolve(OMNI_ROOT, ".env.example");
  let envTemplate = "";
  try {
    envTemplate = await readFile(envTemplatePath, "utf-8");
  } catch {
    // fallback if .env.example doesn't exist
    envTemplate = Array.from(envEntries.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
  }

  const envContent = buildEnvFile(envEntries, envTemplate);
  const yamlContent = buildYaml(primary, extras);

  await writeFile(CONFIG_PATH, yamlContent, "utf-8");
  await writeFile(ENV_PATH, envContent, "utf-8");

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log();
  console.log(`${chalk.green("  ✓")} config/omni-ai.yaml criado`);
  console.log(`${chalk.green("  ✓")} .env atualizado`);
  console.log();
  console.log(chalk.bold("  Próximos passos:"));
  console.log();
  console.log(chalk.cyan("    omni list agents") + chalk.dim("              # ver todos os agentes disponíveis"));
  console.log(chalk.cyan("    omni run code-reviewer") + chalk.dim(' "revise src/app.ts"'));
  console.log();

  if (agentSets.includes("backend")) {
    console.log(chalk.cyan("    omni run backend-dev") + chalk.dim(' "crie o módulo de pedidos"'));
  }
  if (agentSets.includes("frontend")) {
    console.log(chalk.cyan("    omni run frontend-dev") + chalk.dim(' "crie a página de listagem de pedidos"'));
  }
  if (agentSets.includes("ux")) {
    console.log(chalk.cyan("    omni run ux-lead") + chalk.dim(' "audite o componente OrderForm"'));
  }
  if (agentSets.includes("qa")) {
    console.log(chalk.cyan("    omni run qa-lead") + chalk.dim(' "valide src/orders/"'));
  }

  console.log();
  console.log(chalk.dim("  Para usar de outro projeto:"));
  console.log(chalk.dim("    cd /caminho/para/meu-projeto"));
  console.log(chalk.cyan("    omni run backend-dev") + chalk.dim(' "..."'));
  console.log();
}
