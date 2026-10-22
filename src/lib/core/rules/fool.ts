/**
 * The Fool: "The first time you die, you don't" (https://wiki.bloodontheclocktower.com/Fool).
 * When the Storyteller marks a Fool dead whose ability is unused and works, the board offers
 * to keep them alive and spend the ability (the Fool's "No Ability" reminder). Never for the
 * Assassin's kill, which works even if the player could not die
 * (https://wiki.bloodontheclocktower.com/Assassin; Trevor, 2026-10-22: "the Assassin overrides
 * everything"). A suggestion: the Storyteller may leave the death as it is.
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';

/** Whether this death is the Fool's first, which their ability stops. */
export function foolSurvives(
	game: Game,
	seatId: SeatId,
	cause: DeathCause | undefined,
	characters: CharacterLookup
): boolean {
	const seat = game.seats[seatId];
	if (!seat || trueCharacter(game, seatId, characters) !== 'fool') return false;
	if (cause === 'assassin') return false;
	if (seat.reminders.some((r) => r.characterId === 'fool' && r.label === 'No Ability'))
		return false;
	// Drunk or poisoned, the Fool has no ability (death itself is what the ability stops).
	return abilityState(game, seatId, characters).impairments.length === 0;
}
