#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import "@omni-ai/provider-google";
import { chainCommand } from "./commands/chain.js";
import { evalCommand } from "./commands/eval.js";
import { exportCommand } from "./commands/export.js";
import { historyDoctorCommand } from "./commands/history/doctor.js";
import { historyImportCommand } from "./commands/history/import.js";
import { historyLocateEventCommand, historyLocateSessionCommand } from "./commands/history/locate.js";
import { historySearchCommand } from "./commands/history/search.js";
import { historyShowEventCommand, historyShowSessionCommand } from "./commands/history/show.js";
import { historySourcesCommand } from "./commands/history/sources.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";
import { newCommand } from "./commands/new.js";
import { runCommand } from "./commands/run.js";
import { serveCommand } from "./commands/serve.js";
import { watchCommand } from "./commands/watch.js";

// Load .env from the omni-ai repo root (4 levels up from packages/cli/dist/)
const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = packages/cli/dist/ → 3 levels up = omni-ai root
loadDotenv({ path: resolve(__dirname, "..", "..", "..", ".env") });

const program = new Command();

program.name("omni").description("omni-ai — provider-agnostic AI agents for developer workflows").version("0.1.0");

program
  .command("run <agent> <prompt>")
  .description("Run an agent with a prompt")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .option("-s, --session <id>", "Session ID for memory (format: resourceId:threadId)")
  .option("-o, --output <file>", "Save output to file")
  .option("-v, --verbose", "Show iteration details")
  .option("--stream", "Stream tokens in real time as the agent responds")
  .action(runCommand);

program
  .command("init")
  .description("Interactive setup wizard — creates omni-ai.yaml and configures .env")
  .action(initCommand);

program.command("new").description("Scaffold a new agent, skill or provider from a template").action(newCommand);

program
  .command("chain <prompt> <agents...>")
  .description("Run a sequence of agents, piping each output as the next agent's input")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .option("-o, --output <file>", "Save final output to file")
  .option("-v, --verbose", "Print each agent's full output as the chain progresses")
  .option("-s, --stream", "Stream tokens from each agent in real time")
  .action(chainCommand);

program
  .command("export <sessionId>")
  .description("Export a session history as markdown or JSON")
  .option("-f, --format <format>", "Output format: markdown | json (default: markdown)")
  .option("-o, --output <file>", "Save output to file instead of stdout")
  .option("-l, --limit <n>", "Limit to last N messages")
  .action(exportCommand);

program
  .command("watch <agent> <prompt>")
  .description("Re-run an agent automatically when project files change")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .option("-g, --glob <pattern>", "Glob of files to watch (default: src/**/*.{ts,js,yaml,json})")
  .option("-d, --debounce <ms>", "Debounce delay in ms (default: 500)")
  .option("--stream", "Stream tokens in real time")
  .action(watchCommand);

program
  .command("serve")
  .description("Start a local HTTP server to run agents via REST or SSE")
  .option("-p, --port <number>", "Port to listen on (default: 3000)")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .action(serveCommand);

program
  .command("eval <agent> <dataset>")
  .description("Evaluate an agent against a dataset of (input, expected) pairs")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .option("--concurrency <n>", "Number of parallel evaluations (default: 3)")
  .option("-o, --output <file>", "Save JSON report to file")
  .action(evalCommand);

const mcp = program.command("mcp").description("MCP (Model Context Protocol) integration");

mcp
  .command("serve")
  .description("Expose all registered skills as MCP tools over stdio")
  .option("-c, --config <path>", "Path to omni-ai.yaml")
  .action(mcpServeCommand);

const history = program.command("history").description("Import, search and inspect third-party AI agent history");

history
  .command("sources")
  .description("List known history providers and whether they're importable on this machine")
  .option("--json", "Output as JSON")
  .action(historySourcesCommand);

history
  .command("import")
  .description("Import history from one or all registered providers")
  .option("--provider <name>", "Import a single provider")
  .option("--all", "Import every registered provider")
  .option("--path <path>", "Override the discovered path (requires --provider)")
  .action(historyImportCommand);

history
  .command("search [query]")
  .description('Full-text search over imported history, e.g. omni history search "retry handling"')
  .option("--term <term>", "Search term (repeatable)", (value: string, prev: string[]) => [...prev, value], [])
  .option("--session <id>", "Restrict search to one session")
  .option("--scope <name>", "Restrict search to one project scope (default: current directory's project)")
  .option("--all-projects", "Search across every imported project, not just the current one")
  .option("--limit <n>", "Max results (default: 20)")
  .option("--refresh <mode>", "auto | off | strict (default: auto)")
  .option("--json", "Output as JSON")
  .action(historySearchCommand);

const historyShow = history.command("show").description("Show one event (with context) or a full session");

historyShow
  .command("event <id>")
  .description("Show one event with surrounding context")
  .option("--window <n>", "Events of context before/after (default: 3)")
  .action(historyShowEventCommand);

historyShow
  .command("session <sessionId>")
  .description("Show a full session")
  .option("-f, --format <format>", "text | markdown (default: text)")
  .option("-o, --out <path>", "Write to a file instead of stdout")
  .action(historyShowSessionCommand);

const historyLocate = history.command("locate").description("Report the original source location for an event/session");

historyLocate
  .command("event <id>")
  .description("Locate the source file/line an event was imported from")
  .option("--json", "Output as JSON")
  .action(historyLocateEventCommand);

historyLocate
  .command("session <sessionId>")
  .description("Locate the source file a session was imported from")
  .option("--json", "Output as JSON")
  .action(historyLocateSessionCommand);

history
  .command("doctor")
  .description("Diagnose non-importable sources and broken citations")
  .option("--json", "Output as JSON")
  .action(historyDoctorCommand);

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
