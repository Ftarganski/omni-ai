import type { ProviderConfig } from "../config/schema.js";
import type { IProvider } from "../types.js";
import { FallbackProvider } from "./fallback.js";
import { RetryProvider } from "./retry.js";

type ProviderFactory = (config: ProviderConfig) => IProvider;

const factories = new Map<string, ProviderFactory>();

export function registerProvider(type: string, factory: ProviderFactory): void {
  factories.set(type, factory);
}

export function createProvider(config: ProviderConfig): IProvider {
  const factory = factories.get(config.type);
  if (!factory) {
    throw new Error(`Unknown provider type "${config.type}". Registered: ${[...factories.keys()].join(", ")}`);
  }
  return factory(config);
}

export function buildProvider(cfg: ProviderConfig, allConfigs: ProviderConfig[]): IProvider {
  let provider: IProvider = createProvider(cfg);

  if (cfg.retry) {
    provider = new RetryProvider(provider, cfg.retry);
  }

  if (cfg.fallback) {
    const fallbackCfg = allConfigs.find((p) => p.name === cfg.fallback);
    if (!fallbackCfg) {
      throw new Error(`Fallback provider "${cfg.fallback}" not found in config for provider "${cfg.name}"`);
    }
    let fallbackProvider: IProvider = createProvider(fallbackCfg);
    if (fallbackCfg.retry) {
      fallbackProvider = new RetryProvider(fallbackProvider, fallbackCfg.retry);
    }
    provider = new FallbackProvider([provider, fallbackProvider]);
  }

  return provider;
}

export function getRegisteredProviders(): string[] {
  return [...factories.keys()];
}
