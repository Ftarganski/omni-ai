import { describe, expect, it } from "vitest";
import {
  generateAgentYaml,
  generateProviderFiles,
  generateSkillTs,
  kebabToCamel,
  kebabToPascal,
} from "../../src/commands/new/templates.js";

// ── kebab helpers ─────────────────────────────────────────────────────────────

describe("kebabToPascal", () => {
  it("converts single word", () => {
    expect(kebabToPascal("mistral")).toBe("Mistral");
  });

  it("converts hyphenated name", () => {
    expect(kebabToPascal("analyze-dynamo-schema")).toBe("AnalyzeDynamoSchema");
  });

  it("converts two-part name", () => {
    expect(kebabToPascal("find-pattern")).toBe("FindPattern");
  });
});

describe("kebabToCamel", () => {
  it("leaves single word unchanged", () => {
    expect(kebabToCamel("orders")).toBe("orders");
  });

  it("converts hyphenated name", () => {
    expect(kebabToCamel("analyze-dynamo-schema")).toBe("analyzeDynamoSchema");
  });

  it("converts two-part name", () => {
    expect(kebabToCamel("find-pattern")).toBe("findPattern");
  });
});

// ── generateAgentYaml ─────────────────────────────────────────────────────────

describe("generateAgentYaml", () => {
  const base = {
    name: "backend-service",
    description: "Manages the orders domain",
    systemPrompt: "You are a backend developer.",
    skills: ["read-file", "write-file"],
    maxIterations: 10,
    temperature: 0.3,
  };

  it("includes the agent name", () => {
    expect(generateAgentYaml(base)).toContain("name: backend-service");
  });

  it("includes the description", () => {
    expect(generateAgentYaml(base)).toContain("description: Manages the orders domain");
  });

  it("includes the system prompt as block scalar", () => {
    const yaml = generateAgentYaml(base);
    expect(yaml).toContain("systemPrompt: |");
    expect(yaml).toContain("  You are a backend developer.");
  });

  it("lists selected skills", () => {
    const yaml = generateAgentYaml(base);
    expect(yaml).toContain("  - read-file");
    expect(yaml).toContain("  - write-file");
  });

  it("uses empty placeholder when no skills selected", () => {
    const yaml = generateAgentYaml({ ...base, skills: [] });
    expect(yaml).toContain("[]");
  });

  it("includes maxIterations and temperature", () => {
    const yaml = generateAgentYaml(base);
    expect(yaml).toContain("maxIterations: 10");
    expect(yaml).toContain("temperature: 0.3");
  });

  it("does not include provider or model keys", () => {
    const yaml = generateAgentYaml(base);
    expect(yaml).not.toContain("provider:");
    expect(yaml).not.toContain("model:");
  });
});

// ── generateSkillTs ───────────────────────────────────────────────────────────

describe("generateSkillTs", () => {
  const base = { kebabName: "analyze-orders", description: "Analyzes an order entity" };

  it("exports the correct skill variable name", () => {
    expect(generateSkillTs(base)).toContain("export const analyzeOrdersSkill");
  });

  it("uses the kebab name as skill name string", () => {
    expect(generateSkillTs(base)).toContain('name: "analyze-orders"');
  });

  it("uses the Pascal input type", () => {
    const ts = generateSkillTs(base);
    expect(ts).toContain("export type AnalyzeOrdersInput");
    expect(ts).toContain("ISkill<AnalyzeOrdersInput, string>");
  });

  it("includes the description", () => {
    expect(generateSkillTs(base)).toContain('description: "Analyzes an order entity"');
  });

  it("has _ctx parameter to avoid unused-variable lint errors", () => {
    expect(generateSkillTs(base)).toContain("_ctx: SkillContext");
  });

  it("imports from @omni-ai/core", () => {
    expect(generateSkillTs(base)).toContain('from "@omni-ai/core"');
  });

  it("imports zod", () => {
    expect(generateSkillTs(base)).toContain('from "zod"');
  });
});

// ── generateProviderFiles ─────────────────────────────────────────────────────

describe("generateProviderFiles", () => {
  const base = { kebabName: "mistral", displayName: "Mistral AI", hasVision: false, hasEmbedding: false };

  it("generates three files", () => {
    const files = generateProviderFiles(base);
    expect(files.indexTs).toBeTruthy();
    expect(files.packageJson).toBeTruthy();
    expect(files.tsconfigJson).toBeTruthy();
  });

  it("indexTs exports the Pascal provider class", () => {
    expect(generateProviderFiles(base).indexTs).toContain("export class MistralProvider");
  });

  it("indexTs sets readonly name correctly", () => {
    expect(generateProviderFiles(base).indexTs).toContain('readonly name = "mistral"');
  });

  it("indexTs sets vision capability correctly", () => {
    expect(generateProviderFiles(base).indexTs).toContain("vision: false");
    expect(generateProviderFiles({ ...base, hasVision: true }).indexTs).toContain("vision: true");
  });

  it("indexTs sets embedding capability correctly", () => {
    expect(generateProviderFiles(base).indexTs).toContain("embedding: false");
    expect(generateProviderFiles({ ...base, hasEmbedding: true }).indexTs).toContain("embedding: true");
  });

  it("indexTs registers the provider via ProviderRegistry", () => {
    expect(generateProviderFiles(base).indexTs).toContain("ProviderRegistry.register");
  });

  it("packageJson uses the correct package name", () => {
    const pkg = JSON.parse(generateProviderFiles(base).packageJson) as Record<string, unknown>;
    expect(pkg.name).toBe("@omni-ai/provider-mistral");
  });

  it("packageJson has workspace core dependency", () => {
    const pkg = JSON.parse(generateProviderFiles(base).packageJson) as Record<string, { "@omni-ai/core": string }>;
    expect(pkg.dependencies?.["@omni-ai/core"]).toBe("workspace:*");
  });

  it("tsconfigJson is valid JSON with NodeNext module", () => {
    const tsconfig = JSON.parse(generateProviderFiles(base).tsconfigJson) as {
      compilerOptions: { module: string };
    };
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
  });
});
