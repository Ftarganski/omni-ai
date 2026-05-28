import { serveStdioMcp } from "@omni-ai/mcp";
import {
  analyzeDynamoSchemaSkill,
  analyzeGraphqlSchemaSkill,
  analyzeNestjsModuleSkill,
  findCodePatternSkill,
} from "@omni-ai/skills/backend";
import { searchCodeSkill } from "@omni-ai/skills/code";
import {
  analyzeComponentSkill,
  analyzeModuleStructureSkill,
  findComponentPatternSkill,
} from "@omni-ai/skills/frontend";
import { listDirectorySkill, readFileSkill, writeFileSkill } from "@omni-ai/skills/fs";
import { gitCommitMessageSkill, gitDiffSkill, gitLogSkill, gitStatusSkill } from "@omni-ai/skills/git";
import { httpRequestSkill } from "@omni-ai/skills/http";
import { analyzeImageSkill } from "@omni-ai/skills/multimodal";
import { analyzeTestCoverageSkill, findTestPatternSkill } from "@omni-ai/skills/qa";
import { auditAccessibilitySkill } from "@omni-ai/skills/ux";
import chalk from "chalk";

const skills = [
  readFileSkill,
  writeFileSkill,
  listDirectorySkill,
  searchCodeSkill,
  auditAccessibilitySkill,
  gitStatusSkill,
  gitDiffSkill,
  gitLogSkill,
  gitCommitMessageSkill,
  httpRequestSkill,
  analyzeImageSkill,
  findCodePatternSkill,
  analyzeNestjsModuleSkill,
  analyzeDynamoSchemaSkill,
  analyzeGraphqlSchemaSkill,
  findComponentPatternSkill,
  analyzeComponentSkill,
  analyzeModuleStructureSkill,
  findTestPatternSkill,
  analyzeTestCoverageSkill,
];

export async function mcpServeCommand(): Promise<void> {
  process.stderr.write(chalk.bold.cyan("\n◆ omni mcp serve\n"));
  process.stderr.write(chalk.gray(`  Transport: stdio\n`));
  process.stderr.write(chalk.gray(`  Skills:    ${skills.length}\n`));
  process.stderr.write(chalk.gray("\n  Waiting for MCP client connection…\n\n"));

  await serveStdioMcp(skills, { name: "omni-ai" });

  await new Promise<never>(() => {});
}
