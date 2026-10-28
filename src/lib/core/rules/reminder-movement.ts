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
import { neighbourSeats } from './reminder-targets.ts';

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

/** A neighbour token carried to a new neighbour after players changed seats. */
export interface FollowedReminder {
	reminderId: ReminderId;
	reminder: Reminder;
	fromSeatId: SeatId;
	toSeatId: SeatId;
}

/**
 * Where tokens that follow their character's neighbours (`followsNeighbours`: the Tea Lady's
 * Cannot Die, the No Dashii's Poisoned) go when the seating changes from `before` to `after`.
 * Swapped players take their own tokens with them
 * (https://wiki.bloodontheclocktower.com/Matron), but these abilities act on whoever sits
 * next to the character now (https://wiki.bloodontheclocktower.com/Tea_Lady,
 * https://wiki.bloodontheclocktower.com/No_Dashii), so a token on a player who was a
 * neighbour and no longer is goes to a new neighbour without one. A token the Storyteller put
 * on someone who was not a neighbour stays put, and none is added or removed.
 */
export function neighbourFollows(
	before: Game,
	after: Game,
	characters: CharacterLookup
): FollowedReminder[] {
	const moves: FollowedReminder[] = [];
	const groups = new Map<string, { reminder: Reminder; held: [SeatId, ReminderId][] }>();
	for (const seatId of before.seating) {
		for (const r of before.seats[seatId].reminders) {
			if (!reminderMovementOf(r.characterId, characters)?.followsNeighbours?.includes(r.label))
				continue;
			const key = JSON.stringify([r.characterId, r.label, r.ownerSeatId ?? null]);
			const group = groups.get(key) ?? {
				reminder: {
					characterId: r.characterId,
					label: r.label,
					...(r.ownerSeatId ? { ownerSeatId: r.ownerSeatId } : {})
				},
				held: []
			};
			group.held.push([seatId, r.reminderId]);
			groups.set(key, group);
		}
	}
	for (const { reminder, held } of groups.values()) {
		const centres = reminder.ownerSeatId ? [reminder.ownerSeatId] : undefined;
		const was = neighbourSeats(before, reminder, characters, centres) ?? [];
		const now = neighbourSeats(after, reminder, characters, centres) ?? [];
		const free = now.filter((id) => !held.some(([seatId]) => seatId === id));
		for (const [seatId, reminderId] of held) {
			if (!was.includes(seatId) || now.includes(seatId)) continue;
			const toSeatId = free.shift();
			if (toSeatId === undefined) break;
			moves.push({ reminderId, reminder, fromSeatId: seatId, toSeatId });
		}
	}
	return moves;
}
