import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { ZodError } from "zod";
import { type OmniAiConfig, OmniAiConfigSchema } from "./schema.js";

function substituteEnvVars(text: string): string {
  return text.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? "");
}

function formatZodError(err: ZodError): string {
  const lines = err.errors.map((e) => `  • ${e.path.join(".")}: ${e.message}`);
  return `Invalid omni-ai.yaml configuration:\n${lines.join("\n")}`;
}

export async function loadConfig(configPath?: string): Promise<OmniAiConfig> {
  const filePath = configPath ?? resolve(process.cwd(), "config", "omni-ai.yaml");
  const raw = await readFile(filePath, "utf-8");
  const substituted = substituteEnvVars(raw);
  const data = YAML.parse(substituted) as unknown;
  try {
    return OmniAiConfigSchema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(formatZodError(err));
    }
    throw err;
  }
}
