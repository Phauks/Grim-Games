/**
 * The older jinx verbs that are a patch of a rules part, read as that `patch` (M61b): the
 * same pattern as the `learns` and `gameEnd` presets (M60). A rules file or script keeps the
 * verb as written, and the engine reads the patch it stands for, so a custom character's own
 * jinx can say the same thing with `patch`.
 */
import type { CharacterRules } from './character-rules.ts';
import type { DeadAtLeast, Impairs, JinxEffect, JinxPatch, JinxRules } from './jinx-rules.ts';
import type { CharacterId } from './types.ts';

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

/**
 * `madAsPartner`: the subject's own `madAs` with the partner among its `characters`, so its
 * madness may be about the partner whatever the partner's type (the Cerenovus with the
 * Goblin). Nothing without the subject's own `madAs` choosing a character.
 */
function madAsPatch(
	effect: JinxEffect | undefined,
	about: { partner: CharacterId; own?: CharacterRules } | undefined
): JinxPatch | undefined {
	const own = about?.own?.madAs;
	if (!effect || !about || own?.mad !== 'carrier') return undefined;
	const characters = [...(own.characters ?? []), about.partner];
	return { ...effect, parts: { madAs: { ...own, characters } }, preset: 'madAsPartner' };
}

/**
 * `deadAtLeast`: the subject's own `wakesWhen` with `deadAtLeast` (the King wakes once one
 * player is dead with the Leviathan or Riot in play). Nothing without its own `wakesWhen`.
 */
function deadAtLeastPatch(
	effect: DeadAtLeast | undefined,
	own: CharacterRules | undefined
): JinxPatch | undefined {
	if (!effect || !own?.wakesWhen) return undefined;
	const { dead, ...rest } = effect;
	return {
		...rest,
		parts: { wakesWhen: { ...own.wakesWhen, deadAtLeast: dead } },
		preset: 'deadAtLeast'
	};
}

/**
 * A jinx entry's patches: its own `patch`, then each older verb read as one. `about` names the
 * partner and the subject's own rules, for a verb whose patch is built from them.
 */
export function jinxPatches(
	rule: JinxRules | undefined,
	about?: { partner: CharacterId; own?: CharacterRules }
): JinxPatch[] {
	if (!rule) return [];
	return [
		rule.patch,
		impairsPatch(rule.impairs),
		madAsPatch(rule.madAsPartner, about),
		deadAtLeastPatch(rule.deadAtLeast, about?.own)
	].filter((p): p is JinxPatch => p !== undefined);
}
