import type { ISkill } from "../types.js";
export declare class SkillRegistry {
    private skills;
    register(skill: ISkill): this;
    get(name: string): ISkill;
    all(): ISkill[];
}
//# sourceMappingURL=registry.d.ts.map