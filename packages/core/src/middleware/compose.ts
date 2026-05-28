import type { ISkill, SkillContext, SkillMiddlewareFn } from "../types.js";

/**
 * Wraps a skill with a middleware chain. Middleware runs in order; each calls
 * `next()` to pass control down the chain, with the actual skill at the bottom.
 */
export function composeMiddleware(fns: SkillMiddlewareFn[], skill: ISkill): ISkill {
  if (fns.length === 0) return skill;

  return {
    name: skill.name,
    description: skill.description,
    execute(input: unknown, ctx: SkillContext): Promise<unknown> {
      let index = 0;

      const dispatch = (): Promise<unknown> => {
        if (index < fns.length) {
          const fn = fns[index++];
          return fn(skill.name, input, ctx, dispatch);
        }
        return skill.execute(input, ctx);
      };

      return dispatch();
    },
  };
}
