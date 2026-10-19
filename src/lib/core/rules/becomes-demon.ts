/**
 * Reminders that say a player has become the Demon (Trevor, 2026-10-19: "populate a choice to
 * change them into the demon"). Placing one offers to change that player's character to the
 * Demon they take over; the Storyteller confirms or leaves the character as it is.
 *
 * Only the Scarlet Woman for now: when the Demon dies with 5 or more players alive, she
 * becomes that Demon (https://wiki.bloodontheclocktower.com/Scarlet_Woman). Others that
 * hand on the Demon (Imp, Fang Gu, Pit-Hag) can join `BECOMES_DEMON` later.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, Reminder, SeatId } from '#lib/core/model/types.ts';

/** The reminder, by its character, that marks the player as now the Demon. */
export const BECOMES_DEMON: Readonly<Partial<Record<CharacterId, string>>> = {
	scarletwoman: 'Is The Demon'
};

/**
 * The Demon character to offer `seatId`, which just got `reminder`: the dead Demon's (the
 * one taken over), else another Demon in play. None when the reminder doesn't say so, the
 * player is a Demon already, or no Demon is on the board.
 */
export function demonToBecome(
	game: Game,
	seatId: SeatId,
	reminder: Reminder,
	characters: CharacterLookup
): CharacterId | undefined {
	if (BECOMES_DEMON[reminder.characterId] !== reminder.label) return undefined;
	if (typeOf(game, seatId, characters) === 'demon') return undefined;
	const demons = game.seating.filter(
		(id) => id !== seatId && typeOf(game, id, characters) === 'demon'
	);
	const taken = demons.find((id) => game.seats[id].dead) ?? demons[0];
	return taken === undefined ? undefined : trueCharacter(game, taken, characters);
}
