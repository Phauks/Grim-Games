/**
 * Jinx rules that load but can never change anything (M44), for a script load warning: the
 * rule is kept, and the author learns why it does nothing.
 * - `registersTo` without `always` that adds only what its subject already may register as:
 *   its own character type, that type's usual alignment, and its own `registersAs` (the Spy
 *   already may register as good, so "the Spy registers as good to X" needs `always`);
 * - `noKill` `token` where the partner's own `stopsKilling` token already stops the kill;
 * - a condition naming a third character (`alive`, `inPlay`) that is not on the script, so no
 *   player can be it.
 */
import type { CharacterRules } from './character-rules.ts';
import { namedCharacters } from './jinx-conditions.ts';
import { subjectOf } from './jinx-needs.ts';
import type { JinxEffect, JinxRuleKey, JinxRules } from './jinx-rules.ts';
import type { Alignment, CharacterId, CharacterType } from './types.ts';

/** What the check needs to know about the script's characters. */
export interface NoOpContext {
	typeOf: (id: CharacterId) => CharacterType | undefined;
	rulesOf: (id: CharacterId) => CharacterRules | undefined;
	onScript: (id: CharacterId) => boolean;
	name: (id: CharacterId) => string;
}

const USUAL: Partial<Record<CharacterType, Alignment>> = {
	townsfolk: 'good',
	outsider: 'good',
	minion: 'evil',
	demon: 'evil'
};

/** Why each of `rules` (one jinx between `self` and `partner`) changes nothing, if it can't. */
export function jinxNoOps(
	rules: JinxRules,
	self: CharacterId,
	partner: CharacterId,
	ctx: NoOpContext
): string[] {
	const out: string[] = [];
	const whose = (effect: JinxEffect) => (subjectOf(effect) === 'partner' ? partner : self);
	const register = rules.registersTo;
	if (register && !register.always && subjectOf(register) !== 'both') {
		const subject = whose(register);
		const type = ctx.typeOf(subject);
		const usual = type ? USUAL[type] : undefined;
		const own = ctx.rulesOf(subject)?.registersAs?.self;
		const alignments = [...(usual ? [usual] : []), ...(own?.alignments ?? [])];
		const types = [...(type ? [type] : []), ...(own?.types ?? [])];
		const known = usual !== undefined;
		if (
			known &&
			(register.alignments ?? []).every((a) => alignments.includes(a)) &&
			(register.types ?? []).every((t) => types.includes(t))
		)
			out.push(
				`\`registersTo\` adds only what the ${ctx.name(subject)} may already register as, so it changes nothing; add \`always\` to make it the only way they register`
			);
	}
	const noKill = rules.noKill;
	if (noKill?.on === 'token' && subjectOf(noKill) !== 'both') {
		const subject = whose(noKill);
		const other = subject === self ? partner : self;
		const stops = ctx.rulesOf(other)?.stopsKilling;
		if (stops && (!stops.type || stops.type === ctx.typeOf(subject)))
			out.push(
				`\`noKill\` changes nothing: the ${ctx.name(other)}'s own token already stops the ${ctx.name(subject)} killing; use \`on: "chosen"\` if its choice should stop it`
			);
	}
	for (const [key, effect] of Object.entries(rules) as [JinxRuleKey, JinxEffect | true][]) {
		if (effect === true) continue;
		for (const id of namedCharacters(effect.when))
			if (!ctx.onScript(id))
				out.push(
					`\`${key}\` names ${JSON.stringify(id)} in a condition, but no player can be it: it is not on the script`
				);
	}
	return out;
}
