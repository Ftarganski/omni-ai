import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ISkill, SkillContext } from "@omni-ai/core";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.js";
import { connectMcpSkills, McpSkill } from "../src/skill.js";

function makePair() {
  return InMemoryTransport.createLinkedPair();
}

const echoSkill: ISkill = {
  name: "echo",
  description: "Echoes the input back as JSON",
  execute: async (input: unknown) => `echo:${JSON.stringify(input)}`,
};

const failSkill: ISkill = {
  name: "fail",
  description: "Always throws",
  execute: async () => {
    throw new Error("skill error");
  },
};

async function wireServer(skills: ISkill[]) {
  const [serverTransport, clientTransport] = makePair();
  const server = createMcpServer(skills);
  await server.connect(serverTransport);
  return clientTransport;
}

describe("createMcpServer", () => {
  it("lists registered skills as tools", async () => {
    const clientTransport = await wireServer([echoSkill, failSkill]);
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("echo");
    expect(names).toContain("fail");
  });

  it("calls echo skill and returns text content", async () => {
    const clientTransport = await wireServer([echoSkill]);
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "echo", arguments: { msg: "hello" } });
    const text = result.content?.[0];
    expect(text?.type).toBe("text");
    expect((text as { type: "text"; text: string }).text).toBe('echo:{"msg":"hello"}');
  });

  it("returns isError when skill throws", async () => {
    const clientTransport = await wireServer([failSkill]);
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "fail", arguments: {} });
    expect(result.isError).toBe(true);
    const text = result.content?.[0] as { type: "text"; text: string } | undefined;
    expect(text?.text).toContain("skill error");
  });
});

describe("connectMcpSkills", () => {
  it("returns McpSkill instances for each server tool", async () => {
    const [serverTransport, clientTransport] = makePair();
    const server = createMcpServer([echoSkill]);
    await server.connect(serverTransport);

    const skills = await connectMcpSkills(clientTransport);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toBeInstanceOf(McpSkill);
    expect(skills[0].name).toBe("echo");
    expect(skills[0].description).toBe("Echoes the input back as JSON");
  });

  it("executes the remote skill through McpSkill.execute", async () => {
    const [serverTransport, clientTransport] = makePair();
    const server = createMcpServer([echoSkill]);
    await server.connect(serverTransport);

    const skills = await connectMcpSkills(clientTransport);
    const ctx = {} as SkillContext;
    const result = await skills[0].execute({ x: 42 }, ctx);
    expect(result).toBe('echo:{"x":42}');
  });
});
