/**
 * Abilities that stop their player's first death (`survivesFirstDeath` in the rules block),
 * such as the Fool's: "The first time you die, you don't"
 * (https://wiki.bloodontheclocktower.com/Fool). When the Storyteller marks such a player dead
 * while the ability is unused and works, the board offers to keep them alive and spend it
 * (placing its spent token, the Fool's "No Ability"). Never for a kill that ignores
 * protection, such as the Assassin's, which works even if the player could not die
 * (https://wiki.bloodontheclocktower.com/Assassin; Trevor, 2026-10-22: "the Assassin overrides
 * everything"). A suggestion: the Storyteller may leave the death as it is.
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, firstDeathSaver, type FirstDeathSaver } from './ability.ts';
import { NIGHT_KILLERS } from './night-alerts.ts';

/** The ability that stops this death, when it is the player's first and the ability works. */
export function survivesFirstDeath(
	game: Game,
	seatId: SeatId,
	cause: DeathCause | undefined,
	characters: CharacterLookup
): FirstDeathSaver | undefined {
	const saver = firstDeathSaver(game, seatId, characters);
	if (!saver) return undefined;
	if (cause && NIGHT_KILLERS[cause]?.ignoresProtection) return undefined;
	// Drunk or poisoned, the player has no ability (death itself is what the ability stops).
	if (abilityState(game, seatId, characters).impairments.length > 0) return undefined;
	return saver;
}
