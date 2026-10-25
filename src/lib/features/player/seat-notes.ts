/**
 * A player's own note on each seat of their grim (Trevor, 2026-10-24: "allow players to write
 * notes directly from the grim screen relating to players", as the Storyteller has a note per
 * player). Kept on this phone only, per room, like guesses (grim-guesses.ts); seat ids are new
 * in every game, so a new game starts with none.
 *
 * Saved with `schemaVersion`: a newer build can open notes an older one wrote, so
 * `parseSeatNotes` reads every version ever saved.
 */
import { readStored, writeStored } from '#lib/ui/stored.ts';

export const SEAT_NOTES_VERSION = 1;

/** Seat id to the player's note on it. */
export type SeatNotes = Record<string, string>;

/** A room holds at most this many players, so older notes beyond it are dropped. */
const MAX_NOTES = 40;
/** A few paragraphs; anything longer is cut, so one note can't fill the device's storage. */
const MAX_NOTE = 4000;

const key = (room: string) => `grim-games:play:seat-notes:${room}`;

export function parseSeatNotes(raw: unknown): SeatNotes {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const { schemaVersion, notes } = raw as { schemaVersion?: unknown; notes?: unknown };
	if (schemaVersion !== SEAT_NOTES_VERSION) return {};
	if (typeof notes !== 'object' || notes === null || Array.isArray(notes)) return {};
	const entries = Object.entries(notes).flatMap(([seatId, note]) =>
		typeof note === 'string' && note.trim() ? [[seatId, note.slice(0, MAX_NOTE)] as const] : []
	);
	return Object.fromEntries(entries.slice(-MAX_NOTES));
}

/** The notes with `seatId`'s set to `note`, or cleared when it is blank. */
export function withSeatNote(notes: SeatNotes, seatId: string, note: string): SeatNotes {
	const { [seatId]: _old, ...rest } = notes;
	void _old;
	return parseSeatNotes({
		schemaVersion: SEAT_NOTES_VERSION,
		notes: note.trim() ? { ...rest, [seatId]: note } : rest
	});
}

export function readSeatNotes(room: string): SeatNotes {
	return parseSeatNotes(readStored(key(room)));
}

export function writeSeatNotes(room: string, notes: SeatNotes): void {
	writeStored(key(room), { schemaVersion: SEAT_NOTES_VERSION, notes });
}
