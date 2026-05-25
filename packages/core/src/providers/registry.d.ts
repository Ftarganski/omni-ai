import type { IProvider } from "../types.js";
import type { ProviderConfig } from "../config/schema.js";
type ProviderFactory = (config: ProviderConfig) => IProvider;
export declare function registerProvider(type: string, factory: ProviderFactory): void;
export declare function createProvider(config: ProviderConfig): IProvider;
export declare function getRegisteredProviders(): string[];
export {};
//# sourceMappingURL=registry.d.ts.map