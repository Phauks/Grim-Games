/**
 * What the seats show about the reminder in hand (GrimoireBoard): the seats it doesn't fit
 * are faded, and its character's seats and the seats it fits are marked. The reminder is
 * the one being dragged, or the one the bank's setup suggestions point at.
 */
import {
	trueCharacter,
	type CharacterLookup,
	type Game,
	type Reminder,
	type SeatId
} from '#lib/core/model/index.ts';
import { seatMisfits } from './board.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { extraReminders } from './reminders.ts';

/** No seat marked: never changed, so a plain Set. */
const NONE: ReadonlySet<SeatId> = new Set();

/** What the seat hints read from the board, fresh on each call. */
export interface SeatHintsContext {
	grimoire: Grimoire;
	game: Game;
	characters: CharacterLookup;
	/** The reminder being dragged, if any. */
	dragged: Reminder | undefined;
	/** Reminders put down anywhere: nothing is given to a seat, so no seat is marked. */
	loose: boolean;
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

	/** Loose mode marks no seats: nothing is given to one (Trevor, 2026-10-18). */
	readonly #hand = $derived.by(() => {
		const { dragged, loose } = this.#context();
		return loose ? undefined : (dragged ?? this.tray.reminder);
	});

	/**
	 * While a reminder is dragged, the seats it doesn't fit are faded (Trevor, 2026-10-16:
	 * reminder target rules). Warns only: it can still be dropped there.
	 */
	readonly misfits = $derived.by(() => {
		const { grimoire, game, characters } = this.#context();
		if (!this.#hand) return NONE;
		return seatMisfits(game, this.#hand, characters, grimoire.atDawn);
	});

	/** Copies beyond what the game gives (Duplicate reminder): marked as unusual. */
	readonly extras = $derived.by(() => {
		const { grimoire, game, characters } = this.#context();
		return extraReminders(game, characters, grimoire.copies);
	});

	readonly #sources = $derived.by(() => {
		const { game, characters, holders } = this.#context();
		const id = this.#hand?.characterId;
		if (id === undefined) return holders;
		return game.seating.filter(
			(s) => game.seats[s].characterId === id || trueCharacter(game, s, characters) === id
		);
	});

	readonly #targets = $derived.by(() => {
		const { game } = this.#context();
		return this.#hand ? game.seating.filter((s) => !this.misfits.has(s)) : this.tray.seats;
	});

	/**
	 * Marks for the reminder in hand (Trevor, 2026-10-18): the seats whose character it is
	 * (its source), the seats it fits (valid targets), or both. With no reminder in hand, a
	 * walked night step marks its holders as sources.
	 */
	role(seatId: SeatId): 'source' | 'target' | 'both' | undefined {
		const source = this.#sources.includes(seatId);
		const target = this.#targets.includes(seatId);
		return source && target ? 'both' : source ? 'source' : target ? 'target' : undefined;
	}
}
