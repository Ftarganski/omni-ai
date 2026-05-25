import { registerProvider } from "@omni-ai/core";
import { AnthropicProvider } from "./provider.js";

export { AnthropicProvider };

registerProvider("anthropic", (config) =>
  new AnthropicProvider({
    apiKey: config.apiKey!,
    defaultModel: config.defaultModel,
    name: config.name,
  })
);
