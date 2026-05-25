import { readFile } from "fs/promises";
import { resolve } from "path";
import YAML from "yaml";
import { OmniAiConfigSchema } from "./schema.js";
function substituteEnvVars(text) {
    return text.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? "");
}
export async function loadConfig(configPath) {
    const filePath = configPath ?? resolve(process.cwd(), "config", "omni-ai.yaml");
    const raw = await readFile(filePath, "utf-8");
    const substituted = substituteEnvVars(raw);
    const data = YAML.parse(substituted);
    return OmniAiConfigSchema.parse(data);
}
//# sourceMappingURL=loader.js.map