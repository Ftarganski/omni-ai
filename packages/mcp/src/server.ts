import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { IProvider, ISkill, ProviderCapabilities, SkillContext } from "@omni-ai/core";
import { z } from "zod";

const stubProvider: IProvider = {
  name: "mcp-stub",
  capabilities: {} as ProviderCapabilities,
  complete: () => {
    throw new Error("Provider not available in MCP server context");
  },
};

/**
 * Wraps a list of skills as MCP tools and returns a server ready to connect to a transport.
 * Skills that don't call the provider (fs, git, http, …) work transparently.
 */
export function createMcpServer(
  skills: ISkill[],
  options?: { name?: string; version?: string; ctx?: Partial<SkillContext> }
): McpServer {
  const server = new McpServer({
    name: options?.name ?? "omni-ai",
    version: options?.version ?? "0.1.0",
  });

  const ctx: SkillContext = {
    provider: options?.ctx?.provider ?? stubProvider,
    config: options?.ctx?.config ?? {},
  };

  for (const skill of skills) {
    server.registerTool(
      skill.name,
      { description: skill.description, inputSchema: z.record(z.unknown()) },
      async (args) => {
        try {
          const result = await skill.execute(args, ctx);
          const text = typeof result === "string" ? result : JSON.stringify(result);
          return { content: [{ type: "text" as const, text }] };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

/**
 * Creates and connects an MCP server in one step.
 */
export async function serveMcp(
  skills: ISkill[],
  transport: Transport,
  options?: { name?: string; version?: string; ctx?: Partial<SkillContext> }
): Promise<McpServer> {
  const server = createMcpServer(skills, options);
  await server.connect(transport);
  return server;
}

/**
 * Starts the MCP server on stdio. Suitable for use as a subprocess MCP server
 * that Claude Desktop or other MCP clients can spawn.
 */
export async function serveStdioMcp(
  skills: ISkill[],
  options?: { name?: string; version?: string; ctx?: Partial<SkillContext> }
): Promise<McpServer> {
  const transport = new StdioServerTransport();
  return serveMcp(skills, transport, options);
}
