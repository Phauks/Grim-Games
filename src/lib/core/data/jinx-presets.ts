/**
 * The older jinx verbs that are a patch of a rules part, read as that `patch` (M61b): the
 * same pattern as the `learns` and `gameEnd` presets (M60). A rules file or script keeps the
 * verb as written, and the engine reads the patch it stands for, so a custom character's own
 * jinx can say the same thing with `patch`.
 */
import type { Impairs, JinxPatch, JinxRules } from './jinx-rules.ts';

/**
 * `impairs` about the subject's own player, as the part `impairs` with `self.reason` its
 * kind. Not `who: "both"`, `unlessImpaired` or one about the partner's ability a player has
 * (`has-partner-ability`): those are about two players at once, so they stay verbs.
 */
function impairsPatch(effect: Impairs | undefined): JinxPatch | undefined {
	if (!effect || effect.who === 'both' || effect.unlessImpaired) return undefined;
	if (effect.when?.includes('has-partner-ability')) return undefined;
	const { kind, ...rest } = effect;
	return { ...rest, parts: { impairs: { self: { reason: kind } } }, preset: 'impairs' };
}

/** A jinx entry's patches: its own `patch`, then each older verb read as one. */
export function jinxPatches(rule: JinxRules | undefined): JinxPatch[] {
	if (!rule) return [];
	return [rule.patch, impairsPatch(rule.impairs)].filter((p): p is JinxPatch => p !== undefined);
}
