/**
 * The seat notes of each room this page has open, shared by the Grim and Notes tabs, so a
 * note written on one shows on the other at once. Saved on this device only (seat-notes.ts).
 */
import {
	readSeatNotes,
	withSeatNote,
	withoutSeatNote,
	writeSeatNotes,
	type SeatNotes,
	type WrittenNote
} from './seat-notes.ts';

export { notesLine } from './seat-notes.ts';

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache of reactive objects, never read reactively itself
const open = new Map<string, RoomSeatNotes>();

class RoomSeatNotes {
	notes = $state<SeatNotes>({});
	constructor(room: string) {
		this.notes = readSeatNotes(room);
	}
}

/** The room's notes, read from the device the first time. */
export function seatNotes(room: string): { notes: SeatNotes } {
	let book = open.get(room);
	if (!book) {
		book = new RoomSeatNotes(room);
		open.set(room, book);
	}
	return book;
}

/** Throws a room's seat notes away, on this device and on any page that has them open. */
export function forgetSeatNotes(room: string): void {
	seatNotes(room).notes = {};
	writeSeatNotes(room, {});
}

export function saveSeatNote(room: string, seatId: string, note: WrittenNote): void {
	const book = seatNotes(room);
	book.notes = withSeatNote(book.notes, seatId, note);
	writeSeatNotes(room, book.notes);
}

export function deleteSeatNote(room: string, seatId: string, noteId: string): void {
	const book = seatNotes(room);
	book.notes = withoutSeatNote(book.notes, seatId, noteId);
	writeSeatNotes(room, book.notes);
}
