// Pure template-generation functions — no I/O, fully testable.

export interface AgentTemplateParams {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  maxIterations: number;
  temperature: number;
}

export interface SkillTemplateParams {
  kebabName: string;
  description: string;
}

export interface ProviderTemplateParams {
  kebabName: string;
  displayName: string;
  hasVision: boolean;
  hasEmbedding: boolean;
}

export interface ProviderFiles {
  indexTs: string;
  packageJson: string;
  tsconfigJson: string;
}

export function kebabToPascal(s: string): string {
  return s.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

export function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function generateAgentYaml(params: AgentTemplateParams): string {
  const skillLines =
    params.skills.length > 0 ? params.skills.map((s) => `  - ${s}`).join("\n") : "  [] # add skill names here";

  const promptLines = params.systemPrompt
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");

  return `name: ${params.name}
description: ${params.description}
systemPrompt: |
${promptLines}
skills:
${skillLines}
maxIterations: ${params.maxIterations}
temperature: ${params.temperature}
`;
}

export function generateSkillTs(params: SkillTemplateParams): string {
  const pascal = kebabToPascal(params.kebabName);
  const camel = kebabToCamel(params.kebabName);

  return `import type { ISkill, SkillContext } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().describe("Input for ${params.kebabName}"),
});

export type ${pascal}Input = z.infer<typeof InputSchema>;

export const ${camel}Skill: ISkill<${pascal}Input, string> = {
  name: "${params.kebabName}",
  description: "${params.description}",

  async execute(input: ${pascal}Input, _ctx: SkillContext): Promise<string> {
    const { query } = InputSchema.parse(input);
    // TODO: implement ${params.kebabName} logic
    return query;
  },
};
`;
}

export function generateProviderFiles(params: ProviderTemplateParams): ProviderFiles {
  const pascal = kebabToPascal(params.kebabName);

  const indexTs = `import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderCapabilities,
} from "@omni-ai/core";
import { ProviderRegistry } from "@omni-ai/core";

export class ${pascal}Provider implements IProvider {
  readonly name = "${params.kebabName}";
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    embedding: ${params.hasEmbedding},
    streaming: false,
    toolUse: true,
    vision: ${params.hasVision},
  };

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    // TODO: implement ${params.displayName} API call
    throw new Error("Not implemented");
  }
}

ProviderRegistry.register(new ${pascal}Provider());
`;

  const packageJson = JSON.stringify(
    {
      name: `@omni-ai/provider-${params.kebabName}`,
      version: "0.1.0",
      type: "module",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
      scripts: {
        build: "tsc",
        typecheck: "tsc --noEmit",
      },
      dependencies: {
        "@omni-ai/core": "workspace:*",
      },
      devDependencies: {
        typescript: "^5.7.0",
        "@types/node": "^22.0.0",
      },
    },
    null,
    2
  );

  const tsconfigJson = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        outDir: "dist",
        rootDir: "src",
        declaration: true,
        declarationDir: "dist",
        strict: true,
        esModuleInterop: false,
        skipLibCheck: true,
      },
      include: ["src"],
      references: [{ path: "../core" }],
    },
    null,
    2
  );

  return { indexTs, packageJson, tsconfigJson };
}
