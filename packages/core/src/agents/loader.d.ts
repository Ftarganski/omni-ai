import type { OmniAiConfig } from "../config/schema.js";
import type { SkillRegistry } from "../skills/registry.js";
import { Agent } from "./agent.js";
export declare function loadAgent(yamlPath: string, config: OmniAiConfig, skills: SkillRegistry): Promise<Agent>;
//# sourceMappingURL=loader.d.ts.map