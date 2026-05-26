import type { ISkill } from "../types.js";

export class SkillRegistry {
  private skills = new Map<string, ISkill>();

  register(skill: ISkill): this {
    this.skills.set(skill.name, skill);
    return this;
  }

  get(name: string): ISkill {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found. Available: ${[...this.skills.keys()].join(", ")}`);
    }
    return skill;
  }

  all(): ISkill[] {
    return [...this.skills.values()];
  }
}
