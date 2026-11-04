/**
 * Jinxes on a player who has another character's ability (`abilitiesOfSeat`: gained or held,
 * not their own), read for the giver (`data/jinx-rules.ts`), with `has-partner-ability`
 * holding for that player: the Alchemist-Summoner chooses only the Demon, not the player, and
 * gets no bluffs
 * (https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes).
 */
import { choosesChanged, type JinxEffect, type JinxRules } from '#lib/core/data/jinx-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { characterChanger } from './becomes.ts';
import { abilityHolders, abilityOf } from './gained-abilities.ts';
import { ownJinxRules } from './jinxes.ts';
import { aboutHolder, jinxApplies } from './jinx-when.ts';

/** A jinx between the character that gives `seatId` `characterId`'s ability and that character. */
export interface HolderJinx {
	/** The character whose ability they have (the Summoner). */
	characterId: CharacterId;
	/** The character that gives it to them, whose jinx it is (the Alchemist). */
	via: CharacterId;
	rule: JinxRules;
}

/**
 * The jinx, from the giver's side, on `seatId`'s ability of `characterId` when they have it
 * from another character (the Alchemist with the Summoner's). Undefined for their own ability,
 * one they don't have, or no such jinx on the script.
 */
export function holderJinx(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): HolderJinx | undefined {
	const via = abilityOf(game, seatId, characterId, characters)?.via;
	if (via === undefined) return undefined;
	const rule = ownJinxRules(game, via, characterId, characters);
	return rule ? { characterId, via, rule } : undefined;
}

/** Whether `effect` of `jinx` applies to `seatId`, who has the partner's ability. */
function holderApplies(
	game: Game,
	seatId: SeatId,
	jinx: HolderJinx | undefined,
	effect: JinxEffect | undefined,
	characters: CharacterLookup
): boolean {
	if (!jinx || !effect) return false;
	const at = { seatId, hasPartnerAbility: true };
	return jinxApplies(game, jinx.via, jinx.characterId, effect, characters, at);
}

/**
 * The giver whose jinx says the player using `characterId`'s `changesCharacter` tonight chooses
 * only the character, and the Storyteller the player (`storytellerChooses` with
 * `has-partner-ability`: the Alchemist-Summoner chooses which Demon but not which player).
 * Undefined otherwise.
 */
export function picksCharacterOnlyBy(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): CharacterId | undefined {
	const changer = characterChanger(game, characterId, characters);
	if (changer === undefined) return undefined;
	const jinx = holderJinx(game, changer, characterId, characters);
	const effect = jinx?.rule.storytellerChooses;
	if (!choosesChanged(effect) || !aboutHolder(effect)) return undefined;
	return holderApplies(game, changer, jinx, effect, characters) ? jinx?.via : undefined;
}

/**
 * The characters in play (by token or true character) whose `evilInfo` notes are left out of
 * the evil info steps: every player with the ability has none (a Magician while the Vizier is
 * in play, L115), or has it from a giver whose jinx says they get no bluffs (`notShown`
 * `bluffs`: the
 * Alchemist-Summoner). A held ability is only listed while held, so it is never without.
 */
export function evilInfoNotesLeftOut(game: Game, characters: CharacterLookup): CharacterId[] {
	const ids = new Set<CharacterId>();
	for (const s of game.seating) {
		const token = game.seats[s].characterId;
		const own = trueCharacter(game, s, characters);
		if (token) ids.add(token);
		if (own) ids.add(own);
	}
	const without = (s: SeatId, id: CharacterId) =>
		abilityOf(game, s, id, characters)?.how !== 'held' &&
		abilityState(game, s, characters).impairments.some((i) => i.reason === 'no-ability');
	return [...ids].filter((id) => {
		const holders = abilityHolders(game, id, characters);
		return (
			holders.length > 0 &&
			holders.every((s) => {
				const jinx = holderJinx(game, s, id, characters);
				const hidden = jinx?.rule.notShown;
				const bluffs = hidden?.what === 'bluffs' ? hidden : undefined;
				return without(s, id) || holderApplies(game, s, jinx, bluffs, characters);
			})
		);
	});
}
