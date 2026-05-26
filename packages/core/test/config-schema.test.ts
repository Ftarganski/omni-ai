import { describe, it, expect } from "vitest";
import { OmniAiConfigSchema } from "../src/config/schema.js";

const minimalValid = {
  version: "1",
  defaultProvider: "anthropic",
  providers: [
    { name: "anthropic", type: "anthropic", apiKey: "sk-ant-test", defaultModel: "claude-sonnet-4-6" },
  ],
};

describe("OmniAiConfigSchema", () => {
  it("parses a minimal valid config", () => {
    const result = OmniAiConfigSchema.parse(minimalValid);
    expect(result.defaultProvider).toBe("anthropic");
    expect(result.providers).toHaveLength(1);
  });

  it("defaults agentsDir to 'agents'", () => {
    const result = OmniAiConfigSchema.parse(minimalValid);
    expect(result.agentsDir).toBe("agents");
  });

  it("accepts optional agents array", () => {
    const config = {
      ...minimalValid,
      agents: [
        {
          name: "inline-agent",
          description: "test",
          systemPrompt: "You are a test",
          skills: ["read-file"],
        },
      ],
    };
    const result = OmniAiConfigSchema.parse(config);
    expect(result.agents).toHaveLength(1);
    expect(result.agents![0].name).toBe("inline-agent");
  });

  it("rejects config with empty providers array", () => {
    expect(() =>
      OmniAiConfigSchema.parse({ ...minimalValid, providers: [] })
    ).toThrow();
  });

  it("accepts a provider with optional baseUrl", () => {
    const config = {
      ...minimalValid,
      providers: [
        {
          name: "copilot",
          type: "copilot",
          apiKey: "ghp_test",
          defaultModel: "gpt-4o",
          baseUrl: "https://api.githubcopilot.com",
        },
      ],
    };
    const result = OmniAiConfigSchema.parse(config);
    expect(result.providers[0].baseUrl).toBe("https://api.githubcopilot.com");
  });
});
