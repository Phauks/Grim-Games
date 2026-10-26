/**
 * A player's own notes on each seat of their grim (Trevor, 2026-10-24: "allow players to write
 * notes directly from the grim screen relating to players", as the Storyteller has notes per
 * player). Kept on this phone only, per room, like guesses (grim-guesses.ts); seat ids are new
 * in every game, so a new game starts with none.
 *
 * v2 (2026-10-26) keeps several titled notes per seat, as the game's notes (Trevor: "to allow
 * for multiple notes per player"); a v1 seat's one note becomes its untitled first note.
 *
 * Saved with `schemaVersion`: a newer build can open notes an older one wrote, so
 * `parseSeatNotes` reads every version ever saved.
 */
import type { TitledNote } from '#lib/ui/notes/note.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export const SEAT_NOTES_VERSION = 2;

/** Seat id to the player's notes on it, oldest first. */
export type SeatNotes = Record<string, TitledNote[]>;

/** A note as written: no `noteId` adds it. */
export type WrittenNote = Omit<TitledNote, 'noteId'> & { noteId?: string };

/** A room holds at most this many players, so older seats' notes beyond it are dropped. */
const MAX_SEATS = 40;
/** Plenty for one player; older notes beyond it are dropped. */
const MAX_NOTES = 20;
/** A few paragraphs; anything longer is cut, so one note can't fill the device's storage. */
const MAX_NOTE = 4000;
const MAX_TITLE = 200;

const key = (room: string) => `grim-games:play:seat-notes:${room}`;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** A v2 seat's notes; ones that are not notes, or have nothing in them, are dropped. */
function readNotes(raw: unknown): TitledNote[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const notes = raw.flatMap((item): TitledNote[] => {
		if (!isRecord(item) || typeof item.noteId !== 'string' || seen.has(item.noteId)) return [];
		const title = typeof item.title === 'string' ? item.title.slice(0, MAX_TITLE) : '';
		const text = typeof item.text === 'string' ? item.text.slice(0, MAX_NOTE) : '';
		if (!title.trim() && !text.trim()) return [];
		seen.add(item.noteId);
		return [{ noteId: item.noteId, title, text, hidden: item.hidden === true }];
	});
	return notes.slice(-MAX_NOTES);
}

export function parseSeatNotes(raw: unknown): SeatNotes {
	if (!isRecord(raw)) return {};
	const { schemaVersion, notes } = raw;
	if (!isRecord(notes)) return {};
	const entries = Object.entries(notes).flatMap(([seatId, value]): [string, TitledNote[]][] => {
		if (schemaVersion === 1) {
			// One note per seat: it becomes the seat's untitled first note.
			return typeof value === 'string' && value.trim()
				? [[seatId, [{ noteId: 'n1', title: '', text: value.slice(0, MAX_NOTE), hidden: false }]]]
				: [];
		}
		if (schemaVersion !== SEAT_NOTES_VERSION) return [];
		const list = readNotes(value);
		return list.length ? [[seatId, list]] : [];
	});
	return Object.fromEntries(entries.slice(-MAX_SEATS));
}

/**
 * The notes with this note written on `seatId`: replaced in place, or added at the end with
 * the next free id. A note left with nothing in it is dropped.
 */
export function withSeatNote(notes: SeatNotes, seatId: string, note: WrittenNote): SeatNotes {
	const { [seatId]: list = [], ...rest } = notes;
	const noteId =
		note.noteId ??
		`n${list.reduce((max, n) => Math.max(max, Number(n.noteId.slice(1)) || 0), 0) + 1}`;
	const written = { ...note, noteId };
	const next = list.some((n) => n.noteId === noteId)
		? list.map((n) => (n.noteId === noteId ? written : n))
		: [...list, written];
	return parseSeatNotes({ schemaVersion: SEAT_NOTES_VERSION, notes: { ...rest, [seatId]: next } });
}

/** The notes without `seatId`'s note `noteId`. */
export function withoutSeatNote(notes: SeatNotes, seatId: string, noteId: string): SeatNotes {
	const { [seatId]: list = [], ...rest } = notes;
	const next = list.filter((n) => n.noteId !== noteId);
	return parseSeatNotes({
		schemaVersion: SEAT_NOTES_VERSION,
		notes: next.length ? { ...rest, [seatId]: next } : rest
	});
}

export function readSeatNotes(room: string): SeatNotes {
	return parseSeatNotes(readStored(key(room)));
}

export function writeSeatNotes(room: string, notes: SeatNotes): void {
	writeStored(key(room), { schemaVersion: SEAT_NOTES_VERSION, notes });
}
