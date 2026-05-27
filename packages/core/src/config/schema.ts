import { z } from "zod";

export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().positive().default(3),
  initialDelayMs: z.number().int().positive().default(500),
  maxDelayMs: z.number().int().positive().default(30_000),
});

export const ProviderConfigSchema = z.object({
  name: z.string(),
  type: z.enum(["anthropic", "openai", "copilot", "google", "custom"]),
  // nullish handles YAML empty value (parsed as null) and absent key (undefined)
  apiKey: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  baseUrl: z
    .string()
    .url()
    .nullish()
    .transform((v) => v ?? undefined),
  defaultModel: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  options: z.record(z.unknown()).optional(),
  retry: RetryConfigSchema.optional(),
  fallback: z.string().optional(),
});

export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string(),
  skills: z.array(z.string()).optional(),
  maxIterations: z.number().int().positive().default(10),
  temperature: z.number().min(0).max(2).optional(),
});

export const ScaffoldPathsSchema = z.object({
  agents: z.string().default("agents"),
  skills: z.string().default("src/skills"),
  providers: z.string().default("packages"),
});

export const OmniAiConfigSchema = z.object({
  version: z.string().default("1"),
  providers: z.array(ProviderConfigSchema).min(1, "At least one provider must be configured"),
  defaultProvider: z.string(),
  agentsDir: z.string().default("agents"),
  scaffoldPaths: ScaffoldPathsSchema.optional(),
  agents: z.array(AgentConfigSchema).optional(),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type OmniAiConfig = z.infer<typeof OmniAiConfigSchema>;
export type ScaffoldPaths = z.infer<typeof ScaffoldPathsSchema>;
