import { registerProvider } from "@omni-ai/core";
import { OpenAIProvider } from "./provider.js";

export { OpenAIProvider };

registerProvider("openai", (config) => {
  if (!config.apiKey) {
    throw new Error(`Provider "${config.name}" (openai) requires OPENAI_API_KEY to be set in the environment.`);
  }
  return new OpenAIProvider({
    apiKey: config.apiKey,
    defaultModel: config.defaultModel,
    baseUrl: config.baseUrl,
    name: config.name,
  });
});

registerProvider("copilot", (config) => {
  if (!config.apiKey) {
    throw new Error(`Provider "${config.name}" (copilot) requires GITHUB_TOKEN to be set in the environment.`);
  }
  return new OpenAIProvider({
    apiKey: config.apiKey,
    defaultModel: config.defaultModel ?? "gpt-4o",
    baseUrl: config.baseUrl ?? "https://api.githubcopilot.com",
    name: config.name,
  });
});
