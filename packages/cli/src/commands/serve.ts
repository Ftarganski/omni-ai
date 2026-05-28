import { createRuntime } from "@omni-ai/core";
import { SQLiteMemoryStore } from "@omni-ai/memory";
import {
  analyzeDynamoSchemaSkill,
  analyzeGraphqlSchemaSkill,
  analyzeNestjsModuleSkill,
  findCodePatternSkill,
} from "@omni-ai/skills/backend";
import { searchCodeSkill } from "@omni-ai/skills/code";
import {
  analyzeComponentSkill,
  analyzeModuleStructureSkill,
  findComponentPatternSkill,
} from "@omni-ai/skills/frontend";
import { listDirectorySkill, readFileSkill, writeFileSkill } from "@omni-ai/skills/fs";
import { gitCommitMessageSkill, gitDiffSkill, gitLogSkill, gitStatusSkill } from "@omni-ai/skills/git";
import { httpRequestSkill } from "@omni-ai/skills/http";
import { analyzeImageSkill } from "@omni-ai/skills/multimodal";
import { analyzeTestCoverageSkill, findTestPatternSkill } from "@omni-ai/skills/qa";
import { auditAccessibilitySkill } from "@omni-ai/skills/ux";
import chalk from "chalk";
import express from "express";
import { resolveConfigPath } from "../utils/config-path.js";

import "@omni-ai/provider-anthropic";
import "@omni-ai/provider-openai";
import "@omni-ai/provider-google";

interface ServeOptions {
  port?: string;
  config?: string;
}

interface RunBody {
  agent: string;
  prompt: string;
  session?: string;
}

function getDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.omni-ai/sessions.db`;
}

function parseSession(raw: string): { resourceId: string; threadId: string } {
  const [resourceId, ...rest] = raw.split(":");
  return { resourceId, threadId: rest.join(":") || "default" };
}

export async function serveCommand(opts: ServeOptions): Promise<void> {
  const port = opts.port ? Number.parseInt(opts.port, 10) : 3000;
  const configPath = opts.config ?? resolveConfigPath();

  const skills = [
    readFileSkill,
    writeFileSkill,
    listDirectorySkill,
    searchCodeSkill,
    auditAccessibilitySkill,
    gitStatusSkill,
    gitDiffSkill,
    gitLogSkill,
    gitCommitMessageSkill,
    httpRequestSkill,
    analyzeImageSkill,
    findCodePatternSkill,
    analyzeNestjsModuleSkill,
    analyzeDynamoSchemaSkill,
    analyzeGraphqlSchemaSkill,
    findComponentPatternSkill,
    analyzeComponentSkill,
    analyzeModuleStructureSkill,
    findTestPatternSkill,
    analyzeTestCoverageSkill,
  ];

  const runtime = await createRuntime({ configPath, skills }).catch((err: unknown) => {
    console.error(chalk.red(`✖ Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  });

  const app = express();
  app.use(express.json());

  // CORS for local frontend use
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
  });

  app.options("*", (_req: express.Request, res: express.Response) => {
    res.sendStatus(204);
  });

  app.get("/health", (_req: express.Request, res: express.Response) => {
    res.json({ status: "ok", version: "0.1.0" });
  });

  app.get("/agents", async (_req: express.Request, res: express.Response) => {
    try {
      const agents = await runtime.listAgents();
      res.json({ agents });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/run", async (req: express.Request, res: express.Response) => {
    const { agent, prompt, session } = req.body as RunBody;
    if (!agent || !prompt) {
      res.status(400).json({ error: "agent and prompt are required" });
      return;
    }

    try {
      const sessionId = session ? parseSession(session) : undefined;
      const result = await runtime.run(agent, prompt, { session: sessionId });
      res.json({ output: result.output, iterations: result.iterations, usage: result.usage });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/run/stream", async (req: express.Request, res: express.Response) => {
    const { agent, prompt, session } = req.body as RunBody;
    if (!agent || !prompt) {
      res.status(400).json({ error: "agent and prompt are required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: string) => res.write(`data: ${data}\n\n`);

    try {
      const memoryStore = session ? new SQLiteMemoryStore({ path: getDbPath() }) : undefined;
      const sessionId = session ? parseSession(session) : undefined;

      const result = await runtime.run(agent, prompt, {
        session: sessionId,
        onToken: (chunk) => sendEvent(JSON.stringify({ type: "token", content: chunk })),
      });

      await memoryStore?.close?.();
      sendEvent(JSON.stringify({ type: "done", usage: result.usage, iterations: result.iterations }));
    } catch (err) {
      sendEvent(JSON.stringify({ type: "error", error: err instanceof Error ? err.message : String(err) }));
    } finally {
      res.end();
    }
  });

  app.listen(port, () => {
    console.log(chalk.bold.cyan(`\n◆ omni serve`));
    console.log(chalk.gray(`  Listening on  http://localhost:${port}`));
    console.log(chalk.gray(`  GET  /health`));
    console.log(chalk.gray(`  GET  /agents`));
    console.log(chalk.gray(`  POST /run          — JSON response`));
    console.log(chalk.gray(`  POST /run/stream   — SSE stream`));
    console.log(chalk.gray("\n  Press Ctrl+C to stop.\n"));
  });

  // Keep alive
  await new Promise<never>(() => {});
}
