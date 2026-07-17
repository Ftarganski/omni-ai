import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const InputSchema = z.object({
  title: z.string().describe("Short title of the decision, e.g. 'Use PostgreSQL for the orders service'"),
  status: z.string().default("Proposed").describe("ADR status, e.g. Proposed, Accepted, Superseded"),
  context: z.string().describe("The problem/forces that led to this decision"),
  decision: z.string().describe("The decision that was made"),
  alternatives: z.array(z.string()).default([]).describe("Alternatives that were considered and rejected"),
  consequences: z.string().describe("Resulting context — positive and negative consequences of the decision"),
});

export type GenerateAdrInput = z.infer<typeof InputSchema>;

export interface GenerateAdrOutput {
  markdown: string;
}

export const generateAdrSkill: ISkill<GenerateAdrInput, GenerateAdrOutput> = {
  name: "generate-adr",
  description:
    "Generate an Architecture Decision Record in markdown following the standard template (status, context, " +
    "decision, alternatives considered, consequences). Use this to document a design decision after an " +
    "architecture review or discussion.",

  async execute(input: GenerateAdrInput): Promise<GenerateAdrOutput> {
    const { title, status, context, decision, alternatives, consequences } = InputSchema.parse(input);

    const sections = [`# ${title}`, `## Status\n\n${status}`, `## Context\n\n${context}`, `## Decision\n\n${decision}`];

    if (alternatives.length > 0) {
      sections.push(`## Alternatives Considered\n\n${alternatives.map((a) => `- ${a}`).join("\n")}`);
    }

    sections.push(`## Consequences\n\n${consequences}`);

    return { markdown: sections.join("\n\n") };
  },
};
