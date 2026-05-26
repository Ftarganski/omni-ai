import { describe, expect, it } from "vitest";
import { SkillRegistry } from "../src/skills/registry.js";
import type { ISkill } from "../src/types.js";

const makeSkill = (name: string): ISkill => ({
  name,
  description: `${name} skill`,
  execute: async () => `result of ${name}`,
});

describe("SkillRegistry", () => {
  it("registers and retrieves a skill by name", () => {
    const registry = new SkillRegistry();
    const skill = makeSkill("read-file");
    registry.register(skill);
    expect(registry.get("read-file")).toBe(skill);
  });

  it("supports method chaining on register()", () => {
    const registry = new SkillRegistry();
    const result = registry.register(makeSkill("a")).register(makeSkill("b"));
    expect(result).toBe(registry);
    expect(registry.all()).toHaveLength(2);
  });

  it("throws with helpful message when skill not found", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("write-file"));
    expect(() => registry.get("missing")).toThrowError(/missing/);
    expect(() => registry.get("missing")).toThrowError(/write-file/);
  });

  it("all() returns all registered skills", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("a")).register(makeSkill("b")).register(makeSkill("c"));
    expect(registry.all().map((s) => s.name)).toEqual(["a", "b", "c"]);
  });

  it("overwrites a skill registered with the same name", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("tool"));
    const updated = makeSkill("tool");
    registry.register(updated);
    expect(registry.get("tool")).toBe(updated);
    expect(registry.all()).toHaveLength(1);
  });
});
