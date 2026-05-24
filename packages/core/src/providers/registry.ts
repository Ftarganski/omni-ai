import type { IProvider } from "../types.js";
import type { ProviderConfig } from "../config/schema.js";

type ProviderFactory = (config: ProviderConfig) => IProvider;

const factories = new Map<string, ProviderFactory>();

export function registerProvider(type: string, factory: ProviderFactory): void {
  factories.set(type, factory);
}

export function createProvider(config: ProviderConfig): IProvider {
  const factory = factories.get(config.type);
  if (!factory) {
    throw new Error(
      `Unknown provider type "${config.type}". Registered: ${[...factories.keys()].join(", ")}`
    );
  }
  return factory(config);
}

export function getRegisteredProviders(): string[] {
  return [...factories.keys()];
}
