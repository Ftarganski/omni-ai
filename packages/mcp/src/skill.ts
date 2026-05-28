import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ISkill, SkillContext } from "@omni-ai/core";

/**
 * Adapts a remote MCP tool as an ISkill so it can be used inside an omni-ai Agent.
 */
export class McpSkill implements ISkill {
  readonly name: string;
  readonly description: string;
  private client: Client;

  constructor(name: string, description: string, client: Client) {
    this.name = name;
    this.description = description;
    this.client = client;
  }

  async execute(input: unknown, _ctx: SkillContext): Promise<unknown> {
    const args = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : { input };

    const result = await this.client.callTool({ name: this.name, arguments: args });

    type ContentBlock = { type: string; text?: string };
    const content = result.content as ContentBlock[] | undefined;
    const first = content?.[0];
    if (first?.type === "text") return first.text;
    return JSON.stringify(content);
  }
}

/**
 * Connects to an MCP server over the given transport, discovers available tools,
 * and returns one McpSkill per tool.
 */
export async function connectMcpSkills(
  transport: Transport,
  options?: { name?: string; version?: string }
): Promise<McpSkill[]> {
  const client = new Client({
    name: options?.name ?? "omni-ai-client",
    version: options?.version ?? "0.1.0",
  });

  await client.connect(transport);

  const { tools } = await client.listTools();
  return tools.map((t) => new McpSkill(t.name, t.description ?? "", client));
}
