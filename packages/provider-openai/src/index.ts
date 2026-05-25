import { registerProvider } from "@omni-ai/core";
import { OpenAIProvider } from "./provider.js";

export { OpenAIProvider };

registerProvider("openai", (config) =>
  new OpenAIProvider({
    apiKey: config.apiKey!,
    defaultModel: config.defaultModel,
    baseUrl: config.baseUrl,
    name: config.name,
  })
);

registerProvider("copilot", (config) =>
  new OpenAIProvider({
    apiKey: config.apiKey!,
    defaultModel: config.defaultModel ?? "gpt-4o",
    baseUrl: config.baseUrl ?? "https://api.githubcopilot.com",
    name: config.name,
  })
);
