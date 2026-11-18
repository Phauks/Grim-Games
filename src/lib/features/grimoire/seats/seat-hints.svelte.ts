/**
 * What the seats show about the reminder in hand (GrimoireBoard): the seats it doesn't fit
 * are faded, and its character's seats and the seats it fits are marked. The reminder is
 * the one being dragged, or the one the bank's setup suggestions point at.
 */
import {
	inPlay,
	type CharacterLookup,
	type Game,
	type Reminder,
	type SeatId
} from '#lib/core/model/index.ts';
import { counts, seatsBehind } from '#lib/core/rules/day/voting.ts';
import { countHighlight } from '#lib/features/day/count-highlight.svelte.ts';
import {
	handMarks,
	handRole,
	pickMarks,
	type HandRole
} from '#lib/features/grimoire/reminders/hand-marks.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
import { extraReminders } from '#lib/features/board/reminders.ts';
import { boardPick } from './board-pick.svelte.ts';

/** No seat marked: never changed, so a plain Set. */
const NONE: ReadonlySet<SeatId> = new Set();

/** What the seat hints read from the board, fresh on each call. */
export interface SeatHintsContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	/** The reminder being dragged, if any. */
	dragged: Reminder | undefined;
	/** The seats a walked night step wakes, marked when no reminder is in hand. */
	holders: SeatId[];
}

/** What the bank's setup suggestions point at (ReminderBank). */
interface TrayHints {
	seats: SeatId[];
	target?: SeatId;
	reminder?: Reminder;
}

export class SeatHints {
	tray = $state<TrayHints>({ seats: [] });
	#context: () => SeatHintsContext;

	constructor(context: () => SeatHintsContext) {
		this.#context = context;
	}

	readonly #hand = $derived.by(() => this.#context().dragged ?? this.tray.reminder);

	/** The marks for the reminder in hand (hand-marks.ts, shared with a player's grim). */
	readonly #marks = $derived.by(() => {
		const { grimoire, game, characters } = this.#context();
		if (this.#hand) return handMarks(game, this.#hand, characters, grimoire.atDawn);
		// A player to pick for a night step looks the same (board-pick.svelte.ts).
		if (boardPick.current) return pickMarks(game, boardPick.current);
		// So does a day count tapped beside the board: the seats adding to it (count-highlight).
		const count = countHighlight.current;
		if (!count) return undefined;
		const g = inPlay(game);
		return pickMarks(game, {
			seats: seatsBehind(g, count, characters).filter((s) => counts(g, count, s, characters) > 0),
			sources: []
		});
	});

	/**
	 * While a reminder is dragged, the seats it doesn't fit are faded (Trevor, 2026-10-16:
	 * reminder target rules). Warns only: it can still be dropped there.
	 */
	readonly misfits = $derived(this.#marks?.misfits ?? NONE);

	/** Copies beyond what the game gives (Duplicate reminder): marked as unusual. */
	readonly extras = $derived.by(() => {
		const { grimoire, game, characters } = this.#context();
		return extraReminders(game, characters, grimoire.copies);
	});

	/**
	 * Marks for the reminder in hand (Trevor, 2026-10-18): the seats whose character it is
	 * (its source), the seats it fits (valid targets), or both. With no reminder in hand, a
	 * walked night step marks its holders as sources, and the bank's setup suggestions its seats.
	 */
	role(seatId: SeatId): HandRole | undefined {
		return handRole(
			this.#marks ?? { sources: this.#context().holders, targets: this.tray.seats },
			seatId
		);
	}
}
