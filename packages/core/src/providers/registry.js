const factories = new Map();
export function registerProvider(type, factory) {
    factories.set(type, factory);
}
export function createProvider(config) {
    const factory = factories.get(config.type);
    if (!factory) {
        throw new Error(`Unknown provider type "${config.type}". Registered: ${[...factories.keys()].join(", ")}`);
    }
    return factory(config);
}
export function getRegisteredProviders() {
    return [...factories.keys()];
}
//# sourceMappingURL=registry.js.map