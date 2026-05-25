import { registerProvider } from "@omni-ai/core";
import { AnthropicProvider } from "./provider.js";

export { AnthropicProvider };

registerProvider("anthropic", (config) => {
  if (!config.apiKey) {
    throw new Error(`Provider "${config.name}" (anthropic) requires ANTHROPIC_API_KEY to be set in the environment.`);
  }
  return new AnthropicProvider({
    apiKey: config.apiKey,
    defaultModel: config.defaultModel,
    name: config.name,
  });
});
