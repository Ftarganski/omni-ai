import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ISkill, SkillContext } from "@omni-ai/core";
import { z } from "zod";
import { findTestPatternSkill } from "./find-test-pattern.js";

const PatternTypeSchema = z.enum(["service", "component", "hook", "resolver"]);

const InputSchema = z.object({
  filePath: z.string().describe("Path to the function/component source file to generate a test stub for"),
  directory: z.string().describe("Root directory to search for an existing test as a structural example"),
  patternType: PatternTypeSchema.optional().describe(
    "Test pattern to follow — auto-detected from filePath's name/extension when omitted"
  ),
});

export type GenerateTestStubInput = z.infer<typeof InputSchema>;
export type TestPatternType = z.infer<typeof PatternTypeSchema>;

export interface GenerateTestStubOutput {
  stubPath: string;
  content: string;
  patternType: TestPatternType;
  exampleFile: string | null;
}

function inferPatternType(filePath: string): TestPatternType | null {
  const name = basename(filePath);
  if (name.endsWith(".service.ts")) return "service";
  if (name.endsWith(".resolver.ts")) return "resolver";
  if (/^use[A-Z]/.test(name)) return "hook";
  if (/^[A-Z]/.test(name) && (name.endsWith(".tsx") || name.endsWith(".ts"))) return "component";
  return null;
}

function extractExports(source: string): { named: string[]; defaultName: string | null } {
  const named = [...source.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)].map((m) => m[1]);
  const defaultMatch = /export\s+default\s+(?:function\s+)?(\w+)?/.exec(source);
  const defaultName = defaultMatch ? (defaultMatch[1] ?? null) : null;
  return { named: [...new Set(named)], defaultName };
}

function stubPathFor(filePath: string): string {
  return filePath.replace(/\.(tsx?)$/, (_match, ext) => `.spec.${ext}`);
}

function importSourceSpecifier(filePath: string): string {
  const name = basename(filePath).replace(/\.(tsx?)$/, "");
  return `./${name}`;
}

function buildStubContent(
  filePath: string,
  named: string[],
  defaultName: string | null,
  patternType: TestPatternType
): string {
  const specifier = importSourceSpecifier(filePath);
  const subjects = defaultName ? [defaultName, ...named] : named;
  const primary = subjects[0] ?? basename(filePath).replace(/\.(tsx?)$/, "");

  const importLines: string[] = [];
  if (defaultName) importLines.push(`import ${defaultName} from "${specifier}";`);
  if (named.length > 0) importLines.push(`import { ${named.join(", ")} } from "${specifier}";`);
  if (importLines.length === 0) importLines.push(`import "${specifier}";`);

  const cases = subjects.length > 0 ? subjects : [primary];
  const bodyForCase = (name: string): string => {
    if (patternType === "hook") {
      return `it("TODO: describe ${name}'s behavior", () => {\n    expect(${name}).toBeDefined();\n  });`;
    }
    if (patternType === "component") {
      return `it("TODO: describe ${name}'s rendered output", () => {\n    expect(${name}).toBeDefined();\n  });`;
    }
    return `it("TODO: describe expected behavior", () => {\n    expect(${name}).toBeDefined();\n  });`;
  };

  const its = cases.map(bodyForCase).join("\n\n  ");

  return `${importLines.join("\n")}\n\ndescribe("${primary}", () => {\n  ${its}\n});\n`;
}

export const generateTestStubSkill: ISkill<GenerateTestStubInput, GenerateTestStubOutput> = {
  name: "generate-test-stub",
  description:
    "Generate a test file skeleton for a given function/component, matching the structural pattern of an existing " +
    "real test found via find-test-pattern. Use this before writing a new test to get imports, describe/it scaffolding " +
    "and one placeholder assertion per export already wired up.",

  async execute(input: GenerateTestStubInput, ctx: SkillContext): Promise<GenerateTestStubOutput> {
    const { filePath, directory, patternType: explicitPatternType } = InputSchema.parse(input);
    const patternType = explicitPatternType ?? inferPatternType(filePath);
    if (!patternType) {
      throw new Error(
        `Could not infer a test pattern type from "${filePath}". Pass patternType explicitly (service|component|hook|resolver).`
      );
    }

    const source = await readFile(resolve(filePath), "utf-8");
    const { named, defaultName } = extractExports(source);

    const examples = await findTestPatternSkill.execute({ patternType, directory, maxExamples: 1 }, ctx);
    const exampleFile = examples[0]?.file ?? null;

    return {
      stubPath: stubPathFor(filePath),
      content: buildStubContent(filePath, named, defaultName, patternType),
      patternType,
      exampleFile,
    };
  },
};
