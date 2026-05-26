import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@omni-ai/core": resolve("packages/core/src/index.ts"),
      "@omni-ai/memory": resolve("packages/memory/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        // Entry point with no testable logic
        "packages/cli/src/bin.ts",
        // Provider adapters make live HTTP calls — tested via integration tests only
        "packages/provider-*/src/provider.ts",
        "packages/provider-*/src/index.ts",
        // CLI command handlers require a full agent runtime to run
        "packages/cli/src/commands/**",
        "packages/cli/src/utils/config-path.ts",
        // Config/YAML loaders require files on disk — covered by integration tests
        "packages/core/src/config/loader.ts",
        "packages/core/src/agents/loader.ts",
        "packages/core/src/bootstrap.ts",
        // External-service adapters — SQLite and vector store need real databases
        "packages/memory/src/stores/sqlite.ts",
        "packages/memory/src/stores/semantic-memory-store.ts",
        // Skills infra — CLI entry, provider index re-exports
        "packages/skills/src/index.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      reporter: ["text", "json", "lcov"],
    },
  },
});
