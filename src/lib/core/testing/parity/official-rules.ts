/**
 * Test support only: the parity run's stand-in for `#lib/core/data/rules/index.ts` (M57).
 *
 * The parity run (`npm run check:parity`, `vitest.parity.config.ts`) plays every official
 * character as a custom one: its rules block travels on the character, as a custom
 * character's `rules` does in a script, and the engine gets no official overlay to fall back
 * on. `parityPlugin` swaps the real module for this one everywhere except in this folder, so
 * `OFFICIAL_RULES` is empty and `rulesOf` reads only the character's own block. Anything that
 * still works only for official characters then fails its test.
 */
import {
	OFFICIAL_RULES as REAL_RULES,
	rulesFileOf as realRulesFileOf
} from '../../data/rules/index.ts';
import type { CharacterRules } from '../../data/character-rules.ts';
import type { CharacterId } from '../../data/types.ts';

/** The official rules files, for the parity run to put on its custom copies. */
export const HIDDEN_OFFICIAL_RULES = REAL_RULES;

/** @public Read in place of the real map by every module the swap reaches. */
export const OFFICIAL_RULES: ReadonlyMap<CharacterId, CharacterRules> = new Map();

export function rulesOf(
	characterId: CharacterId,
	characters?: ReadonlyMap<CharacterId, { rules?: CharacterRules }>
): CharacterRules | undefined {
	return characters?.get(characterId)?.rules;
}

/** @public As `rulesIn`, with no official fallback. */
export function rulesIn(
	game: { readonly optionalRules?: readonly CharacterId[] },
	characterId: CharacterId,
	characters?: ReadonlyMap<CharacterId, { rules?: CharacterRules }>
): CharacterRules | undefined {
	const rules = rulesOf(characterId, characters);
	if (!rules?.optionalRule || !game.optionalRules?.includes(characterId)) return rules;
	return { ...rules, ...rules.optionalRule };
}

/** @public As `rulesOfCharacter`, with no official fallback. */
export function rulesOfCharacter(character: {
	id: CharacterId;
	edition?: string;
	rules?: CharacterRules;
}): CharacterRules | undefined {
	return rulesOf(character.id, new Map([[character.id, character]]));
}

/** @public Showing a rules file is not behaviour, so the Reference keeps the real one. */
export const rulesFileOf = realRulesFileOf;
