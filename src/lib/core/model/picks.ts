/**
 * A reminder token's picks, oldest first (M90): read from the game's log by
 * `engine/pick-history.ts`, and compared by rules that need an earlier choice, such as a pick
 * that must differ from the one before.
 */
import type { Game, Reminder, ReminderId, SeatId } from './types.ts';

export interface Pick {
	reminderId: ReminderId;
	seatId: SeatId;
	/**
	 * The night the pick belongs to: Night N runs from Day N-1's New day to Day N's (picks
	 * before the first New day are Night 1's). A Dusk that changes nothing writes no log entry,
	 * so a pick made by day counts with the night after it.
	 */
	night: number;
	/** The game just after the pick: what the picked seat was then (its character type). */
	game: Game;
}

/** The picks made before tonight, the night the next pick belongs to. */
export interface PastPicks {
	/** Tonight's number: the night under way, or the one coming by day. */
	readonly tonight: number;
	/** The past picks of a token (by character, label and, when given, owner), oldest first. */
	of(reminder: Reminder): readonly Pick[];
}
