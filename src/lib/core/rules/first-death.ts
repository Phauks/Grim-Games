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
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, firstDeathSaver, type FirstDeathSaver } from './ability.ts';
import { nightKiller, onDeathApplies, onDeathTrigger } from './night-alerts.ts';

/** The ability that stops this death, when it is the player's first and the ability works. */
export function survivesFirstDeath(
	game: Game,
	seatId: SeatId,
	cause: DeathCause | undefined,
	characters: CharacterLookup
): FirstDeathSaver | undefined {
	const saver = firstDeathSaver(game, seatId, characters);
	if (!saver) return undefined;
	if (cause && nightKiller(cause, characters)?.ignoresProtection) return undefined;
	// Drunk or poisoned, the player has no ability (death itself is what the ability stops).
	if (abilityState(game, seatId, characters).impairments.length > 0) return undefined;
	return saver;
}

/** A reminder its player's death puts on them, and whose ability it is. */
export interface DeathReminder {
	characterId: CharacterId;
	label: ReminderLabel;
}

/**
 * The reminder this death puts on the player (`onDeath.places`): the Barber's "Haircuts
 * Tonight", the night the Demon may swap two players' characters
 * (https://wiki.bloodontheclocktower.com/Barber). Only when the death's cause sets the ability
 * off, the ability works (drunk or poisoned, it does nothing) and the reminder is not on them
 * yet. A suggestion: the Storyteller may leave it off.
 */
export function deathReminder(
	game: Game,
	seatId: SeatId,
	cause: DeathCause | undefined,
	characters: CharacterLookup
): DeathReminder | undefined {
	const seat = game.seats[seatId];
	const characterId = trueCharacter(game, seatId, characters);
	const trigger = characterId ? onDeathTrigger(characterId, characters) : undefined;
	if (!seat || !characterId || !trigger?.places) return undefined;
	if (!onDeathApplies(trigger, cause, characters)) return undefined;
	if (abilityState(game, seatId, characters).impairments.length > 0) return undefined;
	const label = trigger.places.toLowerCase();
	if (seat.reminders.some((r) => r.characterId === characterId && r.label.toLowerCase() === label))
		return undefined;
	return { characterId, label: trigger.places };
}
