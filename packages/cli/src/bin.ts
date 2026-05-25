#!/usr/bin/env node
import { resolve } from "path";
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { listCommand } from "./commands/list.js";

// Load .env from the omni-ai repo root (4 levels up from packages/cli/dist/)
const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = packages/cli/dist/ → 3 levels up = omni-ai root
loadDotenv({ path: resolve(__dirname, "..", "..", "..", ".env") });

const program = new Command();

program
  .name("omni")
  .description("omni-ai — provider-agnostic AI agents for developer workflows")
  .version("0.1.0");

program
  .command("run <agent> <prompt>")
  .description("Run an agent with a prompt")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .option("-s, --session <id>", "Session ID for memory (format: resourceId:threadId)")
  .option("-o, --output <file>", "Save output to file")
  .option("-v, --verbose", "Show iteration details")
  .action(runCommand);

const list = program.command("list").description("List available resources");

list
  .command("agents")
  .description("List all available agents")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .action((opts) => listCommand("agents", opts));

list
  .command("skills")
  .description("List registered skills")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .action((opts) => listCommand("skills", opts));

list
  .command("providers")
  .description("List registered providers")
  .action((opts) => listCommand("providers", opts));

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
