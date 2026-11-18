/**
 * What the seats show about the reminder in hand (Trevor, 2026-10-16 and 2026-10-18): the
 * seats it doesn't fit are faded, its character's seats ringed and the seats it fits glow.
 * ONE rule for the Storyteller's board (SeatHints) and a player's grim (PlayerGrim, from the
 * characters its seats show), drawn by SeatDisc on both (Trevor, 2026-11-10: Local Grim
 * should match the Storyteller).
 */
import {
	trueCharacter,
	type CharacterLookup,
	type Game,
	type Reminder,
	type SeatId
} from '#lib/core/model/index.ts';
import { seatMisfits } from '#lib/features/grimoire/board.ts';

/** A seat's part for the reminder in hand: its character's seat, a seat it fits, or both. */
export type HandRole = 'source' | 'target' | 'both';

export interface HandMarks {
	/** Seats it doesn't fit: faded, still choosable. */
	misfits: ReadonlySet<SeatId>;
	/** Seats whose character it is. */
	sources: readonly SeatId[];
	/** Seats it fits. */
	targets: readonly SeatId[];
}

/** The marks for `reminder` in hand on `game`'s seats. */
export function handMarks(
	game: Game,
	reminder: Reminder,
	characters: CharacterLookup,
	atDawn?: Game
): HandMarks {
	const misfits = seatMisfits(game, reminder, characters, atDawn);
	const id = reminder.characterId;
	return {
		misfits,
		sources: game.seating.filter(
			(s) => game.seats[s].characterId === id || trueCharacter(game, s, characters) === id
		),
		targets: game.seating.filter((s) => !misfits.has(s))
	};
}

/** A seat's role from its sources and targets. */
export function handRole(
	marks: Pick<HandMarks, 'sources' | 'targets'>,
	seatId: SeatId
): HandRole | undefined {
	const source = marks.sources.includes(seatId);
	const target = marks.targets.includes(seatId);
	return source && target ? 'both' : source ? 'source' : target ? 'target' : undefined;
}

/**
 * The marks for a player to pick for a night step (board-pick.svelte.ts), the same as for a
 * reminder in hand: the seats that may be picked glow, the rest fade, the picker's are ringed.
 */
export function pickMarks(
	game: Game,
	pick: { seats: readonly SeatId[]; sources: readonly SeatId[] }
): HandMarks {
	const fits = new Set(pick.seats);
	return {
		misfits: new Set(game.seating.filter((s) => !fits.has(s))),
		sources: pick.sources,
		targets: pick.seats
	};
}
