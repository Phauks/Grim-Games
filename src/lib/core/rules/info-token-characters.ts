/**
 * The characters an info token on a night step is shown with, ready filled in (Trevor,
 * 2026-10-24): the character's `infoTokenCharacters` rule, with `self` read as the
 * character itself. The Storyteller can still change them.
 */
import type { InfoTokenCharacterRules } from '#lib/core/data/info-token-rules.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';

/** The characters filled in, and how many the card may show in all on this step. */
export interface FilledInfoToken {
	characterIds: readonly CharacterId[];
	upTo: number;
}

/**
 * A character's `infoTokenCharacters` rule: a homebrew character's own only (its text is its
 * own), else our overlay file's.
 */
export function infoTokenCharacterRulesOf(
	character: Pick<Character, 'id' | 'edition' | 'rules'>
): InfoTokenCharacterRules | undefined {
	if (character.edition === undefined) return character.rules?.infoTokenCharacters;
	return rulesOf(character.id)?.infoTokenCharacters;
}

/**
 * What `character`'s step fills in on the info token `tokenId`, which shows up to `count`
 * characters on its own; nothing when its rules say nothing.
 */
export function filledInfoToken(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	tokenId: string,
	count: number
): FilledInfoToken | undefined {
	const rule = infoTokenCharacterRulesOf(character)?.[tokenId];
	if (!rule) return undefined;
	return {
		characterIds: rule.characters.map((c) => (c === 'self' ? character.id : c)),
		upTo: Math.max(rule.upTo ?? count, rule.characters.length)
	};
}
