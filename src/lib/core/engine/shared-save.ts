/**
 * What Share grim sends of a finished game (Trevor, 2026-11-15: "we don't always want to share
 * everything"): the Storyteller picks whether the room gets the game's history and their notes.
 * The grimoire itself, every seat's character and reminders, always goes.
 */
import type { GameEvent } from './events.ts';
import type { LogEntry } from './log.ts';
import type { SavedGame } from './persistence.ts';

export interface ShareChoices {
	/** Each change, so phones can step back through the game; off sends only how it ended. */
	history: boolean;
	/** The notes on each seat and on its reminders. */
	seatNotes: boolean;
	/** The notes on the game as a whole. */
	gameNotes: boolean;
}

/** What goes unless the Storyteller picks otherwise: the history, and none of their notes. */
export const DEFAULT_SHARE_CHOICES: ShareChoices = {
	history: true,
	seatNotes: false,
	gameNotes: false
};

const SEAT_NOTE_EVENTS = new Set<GameEvent['type']>([
	'SeatNoteSaved',
	'SeatNoteDeleted',
	'ReminderNoteSet'
]);
const GAME_NOTE_EVENTS = new Set<GameEvent['type']>(['GameNoteSet', 'GameNoteDeleted']);

/**
 * The save to send: notes left out unless chosen, from the history too, since it records each
 * note as it was saved. Without history the applied changes become one first entry, so the
 * game replays to how it ended with nothing to step through. The redo stack never goes.
 */
export function sharedSave(saved: SavedGame, choices: ShareChoices): SavedGame {
	const keep = (event: GameEvent) =>
		(choices.seatNotes || !SEAT_NOTE_EVENTS.has(event.type)) &&
		(choices.gameNotes || !GAME_NOTE_EVENTS.has(event.type));
	const applied = saved.log.entries.slice(0, saved.log.cursor);
	const [first, ...rest] = applied.map((entry) => ({
		...entry,
		events: entry.events.filter(keep)
	}));
	const entries: LogEntry[] = choices.history
		? [first, ...rest.filter((entry) => entry.events.length > 0)]
		: [{ ...first, events: [...first.events, ...rest.flatMap((entry) => entry.events)] }];
	return { ...saved, log: { entries, cursor: entries.length } };
}
