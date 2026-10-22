/**
 * Nominations (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"): who nominated
 * whom today, from the day log the engine keeps (`Nominate`, `EditNomination` and
 * `RemoveDayEntry` record them; the engine warns on a second nomination by or of a player, or
 * a dead nominator). Special rules that act on a nomination read them from here.
 */
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** Today's nominations, in the order they were made. */
export function todaysNominations(game: Game): Nomination[] {
	return game.today.entries.filter((e): e is Nomination => e.kind === 'nomination');
}

/** A seat's part in today's nominations: the one it made and the one it received, if any. */
export function seatNominations(
	game: Game,
	seatId: SeatId
): { made?: Nomination; received?: Nomination } {
	const today = todaysNominations(game);
	const made = today.find((n) => n.nominator === seatId);
	const received = today.find((n) => n.nominee === seatId);
	return { ...(made ? { made } : {}), ...(received ? { received } : {}) };
}
