import { describe, expect, it } from "vitest";
import { generateAdrSkill } from "../../src/architecture/generate-adr.js";

describe("generateAdrSkill", () => {
  it("renders all sections including alternatives", async () => {
    const result = await generateAdrSkill.execute(
      {
        title: "Use PostgreSQL for the orders service",
        context: "We need a relational store with strong consistency for order state.",
        decision: "Adopt PostgreSQL as the primary datastore for the orders service.",
        alternatives: ["MongoDB", "DynamoDB"],
        consequences: "Requires operating a managed PostgreSQL instance; gains transactional guarantees.",
      },
      {} as never
    );

    expect(result.markdown).toContain("# Use PostgreSQL for the orders service");
    expect(result.markdown).toContain("## Status\n\nProposed");
    expect(result.markdown).toContain("## Context");
    expect(result.markdown).toContain("## Decision");
    expect(result.markdown).toContain("## Alternatives Considered\n\n- MongoDB\n- DynamoDB");
    expect(result.markdown).toContain("## Consequences");
  });

  it("omits the Alternatives Considered section when none are given", async () => {
    const result = await generateAdrSkill.execute(
      {
        title: "Adopt trunk-based development",
        context: "Long-lived feature branches are causing painful merges.",
        decision: "Adopt trunk-based development with short-lived branches.",
        consequences: "Requires feature flags for incomplete work.",
      },
      {} as never
    );

    expect(result.markdown).not.toContain("Alternatives Considered");
  });

  it("uses a custom status when provided", async () => {
    const result = await generateAdrSkill.execute(
      {
        title: "Retire the legacy queue",
        status: "Accepted",
        context: "The legacy queue is unmaintained.",
        decision: "Migrate to the new event bus.",
        consequences: "Short migration window with dual-write.",
      },
      {} as never
    );

    expect(result.markdown).toContain("## Status\n\nAccepted");
  });
});
