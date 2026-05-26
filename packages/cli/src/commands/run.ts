import { writeFile } from "node:fs/promises";
import { createRuntime } from "@omni-ai/core";
import { SQLiteMemoryStore } from "@omni-ai/memory";
import { searchCodeSkill } from "@omni-ai/skills-code";
import { listDirectorySkill, readFileSkill, writeFileSkill } from "@omni-ai/skills-fs";
import { auditAccessibilitySkill } from "@omni-ai/skills-ux";
import { resolveConfigPath } from "../utils/config-path.js";
import { agentHeader, errorLine, iterationLine, savedLine, tokenSummary } from "../utils/format.js";

// Trigger provider registration
import "@omni-ai/provider-anthropic";
import "@omni-ai/provider-openai";

interface RunOptions {
  config?: string;
  session?: string;
  output?: string;
  verbose?: boolean;
  stream?: boolean;
}

function parseSession(raw: string): { resourceId: string; threadId: string } {
  const [resourceId, ...rest] = raw.split(":");
  const threadId = rest.join(":") || "default";
  return { resourceId, threadId };
}

function getDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.omni-ai/sessions.db`;
}

export async function runCommand(agent: string, prompt: string, opts: RunOptions): Promise<void> {
  const configPath = opts.config ?? resolveConfigPath();

  const skills = [readFileSkill, writeFileSkill, listDirectorySkill, searchCodeSkill, auditAccessibilitySkill];

  let memoryStore: SQLiteMemoryStore | undefined;
  let sessionId: { resourceId: string; threadId: string } | undefined;

  if (opts.session) {
    sessionId = parseSession(opts.session);
    memoryStore = new SQLiteMemoryStore({ path: getDbPath() });
  }

  const runtime = await createRuntime({ configPath, skills, memoryStore }).catch((err: unknown) => {
    console.error(errorLine(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  });

  const providerLabel = `${runtime.config.defaultProvider} / ${runtime.config.providers.find((p) => p.name === runtime.config.defaultProvider)?.defaultModel ?? "default"}`;
  console.log(`\n${agentHeader(agent, providerLabel)}`);

  const onToken = opts.stream ? (chunk: string) => process.stdout.write(chunk) : undefined;

  if (opts.stream) process.stdout.write("\n");

  const result = await runtime.run(agent, prompt, { session: sessionId, onToken }).catch(async (err: unknown) => {
    console.error(errorLine(err instanceof Error ? err.message : String(err)));
    await memoryStore?.close?.();
    process.exit(1);
  });

  if (opts.stream) {
    process.stdout.write("\n");
  } else {
    console.log(`\n${result.output}\n`);
  }

  console.log(iterationLine(result.iterations));

  if (opts.output) {
    await writeFile(opts.output, result.output, "utf-8");
    console.log(savedLine(opts.output));
  }

  if (result.usage) {
    console.log(tokenSummary(result.usage.inputTokens, result.usage.outputTokens));
  }

  console.log();
  await memoryStore?.close?.();
}
