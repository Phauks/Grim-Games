/**
 * Token integrity: whether a reminder should stay on the seat it was first placed on,
 * and what to say when the Storyteller moves one anyway. Each character's
 * `reminderMovement` rule (`data/reminder-movement-rules.ts`) says which of its tokens stay.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { ReminderMovementRules } from '#lib/core/data/reminder-movement-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, Reminder, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { charactersInPlay } from '#lib/core/model/selectors.ts';

export type { ReminderMovementRules };

/** A character's `reminderMovement` rule: its own (a custom character's) or our overlay file's. */
export function reminderMovementOf(
	characterId: CharacterId,
	characters?: CharacterLookup
): ReminderMovementRules | undefined {
	return rulesOf(characterId, characters)?.reminderMovement;
}

/** Why this reminder should stay where it was first placed, or undefined if it may move. */
export function fixedReminderReason(
	reminder: Reminder,
	characters?: CharacterLookup
): string | undefined {
	const rule = reminderMovementOf(reminder.characterId, characters);
	return rule?.fixed?.includes(reminder.label) ? rule.why : undefined;
}

export function isFixedReminder(reminder: Reminder, characters?: CharacterLookup): boolean {
	return fixedReminderReason(reminder, characters) !== undefined;
}

/** In-play characters whose abilities can legitimately carry a fixed token elsewhere. */
export interface ReminderRelocator {
	characterId: CharacterId;
	does: string;
}

export interface FixedReminderMove {
	reminder: Reminder;
	fromSeatId: SeatId;
	toSeatId: SeatId;
	/** Why the token normally stays put. */
	why: string;
	relocators: ReminderRelocator[];
}

/**
 * What the Storyteller should be told before moving `reminderId` to `toSeatId`, or
 * undefined when the move needs no caution (a moving token, an unknown reminder, or the
 * same seat). The move is still allowed: this is a warning, not a lock.
 */
export function fixedReminderMove(
	game: Game,
	reminderId: ReminderId,
	toSeatId: SeatId,
	characters?: CharacterLookup
): FixedReminderMove | undefined {
	for (const seatId of game.seating) {
		const reminder = game.seats[seatId].reminders.find((r) => r.reminderId === reminderId);
		if (!reminder) continue;
		if (seatId === toSeatId) return undefined;
		const why = fixedReminderReason(reminder, characters);
		if (why === undefined) return undefined;
		const relocators = [...new Set(charactersInPlay(game))].flatMap((characterId) => {
			const does = reminderMovementOf(characterId, characters)?.relocates;
			return does === undefined ? [] : [{ characterId, does }];
		});
		return {
			reminder: { characterId: reminder.characterId, label: reminder.label },
			fromSeatId: seatId,
			toSeatId,
			why,
			relocators
		};
	}
	return undefined;
}
