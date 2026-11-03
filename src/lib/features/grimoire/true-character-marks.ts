import type { Character } from '#lib/core/data/index.ts';
import {
	replacedBy,
	type CharacterLookup,
	type ReminderInstance,
	type Seat
} from '#lib/core/model/index.ts';
import type { BigToken } from './board-looks.svelte.ts';

/** An "Is The …" reminder on a seat, with the character it says the player really is. */
export interface TrueCharacterMark {
	reminder: ReminderInstance;
	character: Character;
}

/**
 * The seat's "Is The …" reminders (the Drunk, Marionette, Lunatic, Philosopher, Apprentice,
 * Alchemist: whatever `replacedBy` reads), each with the character the player really is.
 * Grimbinder's look shows them as small tokens in the seat's pill, marked = (Trevor,
 * 2026-10-31, small token Option A); the reminder is still what the game saves.
 */
export function trueCharacterMarks(seat: Seat, characters: CharacterLookup): TrueCharacterMark[] {
	return seat.reminders.flatMap((reminder) => {
		const character = replacedBy(reminder, characters);
		return character ? [{ reminder, character }] : [];
	});
}

/**
 * The reminders drawn beside the seat, by what the big token shows (`BigToken`): all of them
 * with Reminders only; otherwise the "Is The …" ones leave while the pill can open them, by
 * their = mark or by the ? mark of the token the player was given. A seat with no token keeps
 * its "Is The …" reminder beside it while the big token shows who they really are.
 */
export function remindersBeside(
	seat: Seat,
	characters: CharacterLookup,
	bigToken: BigToken
): ReminderInstance[] {
	if (bigToken === 'reminders' || (bigToken === 'truth' && seat.characterId === undefined))
		return seat.reminders;
	return seat.reminders.filter((reminder) => !replacedBy(reminder, characters));
}
