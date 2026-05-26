import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../src/config/schema.js";
import { createProvider, getRegisteredProviders, registerProvider } from "../src/providers/registry.js";
import type { IProvider } from "../src/types.js";

const fakeProvider: IProvider = {
  name: "fake",
  capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
  complete: async () => ({ content: "", model: "fake", provider: "fake" }),
};

describe("provider registry", () => {
  it("registers a factory and creates a provider instance", () => {
    registerProvider("custom", () => fakeProvider);
    const provider = createProvider({ name: "p", type: "custom" } as ProviderConfig);
    expect(provider).toBe(fakeProvider);
  });

  it("getRegisteredProviders includes the registered type", () => {
    registerProvider("custom", () => fakeProvider);
    expect(getRegisteredProviders()).toContain("custom");
  });

  it("throws when the provider type has no registered factory", () => {
    expect(() => createProvider({ name: "x", type: "copilot" } as ProviderConfig)).toThrow(
      /Unknown provider type/,
    );
  });
});
