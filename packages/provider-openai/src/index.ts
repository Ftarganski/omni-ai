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

registerProvider("groq", (config) => {
  if (!config.apiKey) {
    throw new Error(`Provider "${config.name}" (groq) requires GROQ_API_KEY to be set in the environment.`);
  }
  return new OpenAIProvider({
    apiKey: config.apiKey,
    defaultModel: config.defaultModel ?? "llama-3.3-70b-versatile",
    baseUrl: config.baseUrl ?? "https://api.groq.com/openai/v1",
    name: config.name,
  });
});

registerProvider("ollama", (config) => {
  return new OpenAIProvider({
    // Ollama does not require an API key; use a placeholder so the SDK does not complain
    apiKey: config.apiKey ?? "ollama",
    defaultModel: config.defaultModel ?? "llama3.2",
    baseUrl: config.baseUrl ?? "http://localhost:11434/v1",
    name: config.name,
  });
});
