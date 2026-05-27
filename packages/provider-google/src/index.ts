import { registerProvider } from "@omni-ai/core";
import { GoogleProvider } from "./provider.js";

export { GoogleProvider };

registerProvider("google", (config) => {
  if (!config.apiKey) {
    throw new Error(`Provider "${config.name}" (google) requires GOOGLE_API_KEY to be set in the environment.`);
  }
  return new GoogleProvider({
    apiKey: config.apiKey,
    defaultModel: config.defaultModel,
    name: config.name,
  });
});
