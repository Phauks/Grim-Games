/**
 * Moving the counting reminders at dawn or dusk (plan M53, Trevor 2026-11-04: "certain tokens
 * stack on each other, they are relational ... make these automatically tick up, or offer that
 * as an option"): a character's run of day or night tokens (`counter` in its rules,
 * `data/parts/counter.ts`) gains the one for the new day or night, and a number token set to
 * count up (`countsUp`) goes up by one. Which happens, and whether the Storyteller is asked
 * first, is their setting; this only says what would move.
 */
import type { CounterTime } from '#lib/core/data/parts/counter.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { looseReminders } from '#lib/core/model/selectors.ts';
import {
	GENERIC_REMINDER_ID,
	REMINDER_NUMBER_MAX,
	symbolNumber,
	type Game,
	type ReminderId,
	type SeatId
} from '#lib/core/model/types.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

export type CounterMove =
	/** The run's next token goes on `seatId`. */
	| { kind: 'add'; seatId: SeatId; characterId: CharacterId; label: ReminderLabel }
	/** The run's token on `seatId` is swapped for the next (a character that carries one). */
	| {
			kind: 'replace';
			seatId: SeatId;
			reminderId: ReminderId;
			characterId: CharacterId;
			from: ReminderLabel;
			label: ReminderLabel;
	  }
	/** A number token goes up by one. */
	| { kind: 'number'; reminderId: ReminderId; from: number; to: number };

/**
 * The day or night that `at` begins: after the New day, dawn begins day `pastDays.length`;
 * dusk begins night `pastDays.length + 1` (night 1 is before the first dawn).
 */
export function counterDay(game: Game, at: CounterTime): number {
	return at === 'dawn' ? game.pastDays.length : game.pastDays.length + 1;
}

/** What would move at `at` (run after the New day for dawn, at the Dusk step for dusk). */
export function counterMoves(
	game: Game,
	characters: CharacterLookup,
	at: CounterTime
): CounterMove[] {
	const moves: CounterMove[] = [];
	const n = counterDay(game, at);
	const inPlay = new Set(
		game.seating.map((id) => game.seats[id].characterId).filter((c) => c !== undefined)
	);
	for (const characterId of inPlay) {
		const counter = rulesFor(game, characterId, characters)?.counter;
		if (!counter || counter.at !== at) continue;
		const label = counter.tokens[n - 1];
		if (!label) continue;
		const own = game.seating.flatMap((seatId) =>
			game.seats[seatId].reminders
				.filter((r) => r.characterId === characterId && counter.tokens.includes(r.label))
				.map((r) => ({ seatId, reminder: r }))
		);
		if (own.some((o) => o.reminder.label === label)) continue;
		// Beside the run's tokens already out, else on the character's own seat.
		const last = own.at(-1);
		const seatId =
			last?.seatId ?? game.seating.find((id) => game.seats[id].characterId === characterId);
		if (seatId === undefined) continue;
		if (counter.replaces && last)
			moves.push({
				kind: 'replace',
				seatId: last.seatId,
				reminderId: last.reminder.reminderId,
				characterId,
				from: last.reminder.label,
				label
			});
		else moves.push({ kind: 'add', seatId, characterId, label });
	}
	// Number tokens anywhere on the board: on a seat, a Fabled or Loric, or loose.
	const placed = [
		...game.seating.flatMap((seatId) => game.seats[seatId].reminders),
		...Object.values(game.ruleReminders).flat(),
		...looseReminders(game)
	];
	for (const r of placed) {
		if (r.characterId !== GENERIC_REMINDER_ID || r.countsUp !== at) continue;
		const from = symbolNumber(r.symbol);
		if (from === undefined || from >= REMINDER_NUMBER_MAX) continue;
		moves.push({ kind: 'number', reminderId: r.reminderId, from, to: from + 1 });
	}
	return moves;
}
