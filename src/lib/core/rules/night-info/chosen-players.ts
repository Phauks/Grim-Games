/**
 * Night information: the players a "learn players" character could be shown (Steward: one
 * good player; Noble: three players, one of them evil), as rows, the ones the board's
 * reminders mark first (Trevor, 2026-10-26: suggestions look at where the character's
 * tokens are placed, and emphasise the ones that match). Part of `night-info.ts`.
 *
 * Rows are grouped by the player the information turns on (`InfoOption.pivot`): the
 * Steward's good player, or the Noble's evil player with the players who may be shown
 * beside them.
 */
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { LearnedRoleReason } from './learned-roles.ts';
import { type InfoPicker, type ValidReason, isTruthful, matchingOption } from './picker.ts';

export interface ChosenPlayersRow {
	/** The Steward's good player, the evil one of the Noble's three. */
	target: SeatId;
	/**
	 * Noble: the players who may be shown beside `target`. For a row the board marks in full,
	 * exactly the other marked players.
	 */
	seats: SeatId[];
	reason: LearnedRoleReason;
	/** For `registers`: the players who would register as something else. */
	registered?: SeatId[];
	/** The character's reminders on the board mark this row. */
	marked?: true;
	/** The board marks every player shown: `target` and `seats` are exactly them. */
	exact?: true;
}

export interface ChosenPlayers {
	rows: ChosenPlayersRow[];
	/** Any other choice is valid too: the waking player is droisoned, or the Vortox. */
	anyOther?: ValidReason;
}

/** The seats carrying the picker's `each` reminder (the Steward's and Noble's Know). */
function markedSeats(game: Game, picker: InfoPicker): SeatId[] {
	const label = picker.reminders.each;
	if (!label) return [];
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === picker.characterId && r.label === label)
	);
}

/**
 * The rows for a `players` picker, marked first, then true, then by registration;
 * undefined for other pickers. The app lists them all and never picks one (Trevor,
 * 2026-10-18: "show all valid information").
 */
export function chosenPlayers(game: Game, picker: InfoPicker): ChosenPlayers | undefined {
	if (picker.kind !== 'players') return undefined;
	const anyOther: ValidReason | undefined = picker.unreliable
		? 'unreliable'
		: picker.mustBeFalse
			? 'vortox'
			: undefined;
	// Under the Vortox the truthful options are exactly the ones not allowed.
	const truthful = picker.mustBeFalse && !picker.unreliable ? [] : picker.options;

	const groups = new Map<string, ChosenPlayersRow>();
	for (const o of truthful) {
		const target = o.pivot ?? o.seats[0];
		if (!target) continue;
		const key = JSON.stringify([target, o.registered ?? []]);
		const row =
			groups.get(key) ??
			groups
				.set(key, {
					target,
					seats: [],
					...(o.registered ? { reason: 'registers', registered: o.registered } : { reason: 'true' })
				})
				.get(key)!;
		for (const s of o.seats) if (s !== target && !row.seats.includes(s)) row.seats.push(s);
	}
	const rows = [...groups.values()];

	const marked = markedSeats(game, picker);
	if (marked.length === 0) return { rows, ...(anyOther ? { anyOther } : {}) };

	// Rows that hold every marked player come first, marked.
	const holds = (r: ChosenPlayersRow) => marked.every((s) => s === r.target || r.seats.includes(s));
	const first = rows.filter(holds).map((r): ChosenPlayersRow => ({ ...r, marked: true }));
	const rest = rows.filter((r) => !holds(r));
	if (marked.length !== picker.seatCount) {
		return { rows: [...first, ...rest], ...(anyOther ? { anyOther } : {}) };
	}

	// Every player shown is marked: that exact choice first, valid or not (the Storyteller
	// overrides anything; warn, never lock).
	const choice = { seats: marked };
	const o = matchingOption(picker, choice);
	const reason: LearnedRoleReason = picker.unreliable
		? 'unreliable'
		: picker.mustBeFalse
			? isTruthful(picker, choice)
				? 'invalid'
				: 'vortox'
			: o
				? o.registered
					? 'registers'
					: 'true'
				: 'invalid';
	const target = o?.pivot ?? marked[0];
	const exact: ChosenPlayersRow = {
		target,
		seats: marked.filter((s) => s !== target),
		reason,
		...(reason === 'registers' && o?.registered ? { registered: o.registered } : {}),
		marked: true,
		exact: true
	};
	// A one-player choice (the Steward's) is its own row: replace it rather than repeat it.
	const others = picker.seatCount === 1 ? rest : rows;
	return { rows: [exact, ...others], ...(anyOther ? { anyOther } : {}) };
}
