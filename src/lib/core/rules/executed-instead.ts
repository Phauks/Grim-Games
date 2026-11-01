/**
 * Executed instead (`execution.insteadOf` in a character's rules): the Storyteller may execute
 * the Scapegoat in place of a player of its alignment
 * (https://wiki.bloodontheclocktower.com/Scapegoat). The execution dialog offers it; the
 * Storyteller decides, so nothing here happens on its own.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';

/** A living player who may be executed instead of another, by their character's ability. */
export interface InsteadOffer {
	seatId: SeatId;
	characterId: CharacterId;
}

/** Living players whose character may be executed instead of another (`execution.insteadOf`). */
export function insteadCandidates(game: Game, characters: CharacterLookup): InsteadOffer[] {
	return game.seating.flatMap((seatId) => {
		const characterId = trueCharacter(game, seatId, characters);
		if (characterId === undefined || game.seats[seatId].dead) return [];
		return rulesOf(characterId, characters)?.execution?.insteadOf ? [{ seatId, characterId }] : [];
	});
}

/**
 * Who may be executed instead of the player in `seatId`: a candidate whose ability works, who
 * is not that player, and whose alignment that player has or might register as (the Spy
 * might register as good, so a good Scapegoat may die in the Spy's place).
 */
export function executedInstead(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): InsteadOffer[] {
	const own = alignmentOf(game, seatId);
	const registered = registrations(game, characters).find((r) => r.seatId === seatId);
	return insteadCandidates(game, characters).filter((c) => {
		if (c.seatId === seatId || !abilityState(game, c.seatId, characters).works) return false;
		const alignment = alignmentOf(game, c.seatId);
		return (
			alignment !== undefined && (own === alignment || !!registered?.alignments.includes(alignment))
		);
	});
}
