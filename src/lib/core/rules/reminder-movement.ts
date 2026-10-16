/**
 * Token integrity: whether a reminder should stay on the seat it was first placed on,
 * and what to say when the Storyteller moves one anyway. Curated in
 * `reminder-movement.data.ts`.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { Game, Reminder, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { charactersInPlay } from '#lib/core/model/selectors.ts';
import {
	FIXED_REMINDERS,
	MOVING_REMINDERS,
	REMINDER_RELOCATORS,
	type FixedReminders
} from './reminder-movement.data.ts';

export { FIXED_REMINDERS, MOVING_REMINDERS, REMINDER_RELOCATORS };
export type { FixedReminders };

/** Why this reminder should stay where it was first placed, or undefined if it may move. */
export function fixedReminderReason(reminder: Reminder): string | undefined {
	const entry = FIXED_REMINDERS[reminder.characterId];
	return entry?.labels.includes(reminder.label) ? entry.why : undefined;
}

export function isFixedReminder(reminder: Reminder): boolean {
	return fixedReminderReason(reminder) !== undefined;
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
	toSeatId: SeatId
): FixedReminderMove | undefined {
	for (const seatId of game.seating) {
		const reminder = game.seats[seatId].reminders.find((r) => r.reminderId === reminderId);
		if (!reminder) continue;
		if (seatId === toSeatId) return undefined;
		const why = fixedReminderReason(reminder);
		if (why === undefined) return undefined;
		const inPlay = new Set(charactersInPlay(game));
		const relocators = Object.entries(REMINDER_RELOCATORS)
			.filter(([id]) => inPlay.has(id))
			.map(([characterId, does]) => ({ characterId, does }));
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
