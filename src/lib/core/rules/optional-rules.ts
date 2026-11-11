/**
 * Characters' optional rules (Trevor, 2026-10-30): an official character's optional rule from
 * its wiki page, such as the Hindu's Minion becoming a reborn Demon
 * (https://wiki.bloodontheclocktower.com/Hindu), is that character's own functionality, chosen
 * at the start of the game and shown, on or off, with the special rules. The rules a game turns
 * on replace the character's own (`optionalRule` in a rules block, read by `rulesIn`).
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** One character's optional rule in this game. */
export interface OptionalRuleChoice {
	characterId: CharacterId;
	on: boolean;
	/** Our own wording of the rule (`optionalRuleText`), when the rules block has it. */
	text?: string;
}

/**
 * The characters on the script, on a seat or in play as a Fabled or Loric that have an optional
 * rule, in script order, each with whether this game plays with it.
 */
export function optionalRuleChoices(game: Game, characters: CharacterLookup): OptionalRuleChoice[] {
	const ids = new Set([
		...scriptCharacterIds(game.script),
		...game.ruleCharacters,
		...game.seating.flatMap((id) => game.seats[id].characterId ?? [])
	]);
	return [...ids].flatMap((characterId) => {
		const rules = rulesFor(game, characterId, characters);
		if (rules?.optionalRule === undefined) return [];
		const on = game.optionalRules?.includes(characterId) ?? false;
		const text = rules.optionalRuleText;
		return [{ characterId, on, ...(text ? { text } : {}) }];
	});
}
