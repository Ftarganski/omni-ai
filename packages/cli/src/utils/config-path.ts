import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the default omni-ai.yaml path relative to the CLI package root.
 * Works regardless of cwd, so users can `cd` to their project and run `omni`.
 */
export function resolveConfigPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // __dirname: packages/cli/dist/utils/
  // omni-ai root: 4 levels up
  const omniRoot = resolve(__dirname, "..", "..", "..", "..");
  return resolve(omniRoot, "config", "omni-ai.yaml");
}
