export class SkillRegistry {
    skills = new Map();
    register(skill) {
        this.skills.set(skill.name, skill);
        return this;
    }
    get(name) {
        const skill = this.skills.get(name);
        if (!skill) {
            throw new Error(`Skill "${name}" not found. Available: ${[...this.skills.keys()].join(", ")}`);
        }
        return skill;
    }
    all() {
        return [...this.skills.values()];
    }
}
//# sourceMappingURL=registry.js.map