import { describe, expect, it } from 'vitest';
import {
	parseSeatNotes,
	SEAT_NOTES_VERSION,
	withoutSeatNote,
	withSeatNote,
	type SeatNotes
} from './seat-notes.ts';

const note = (text: string, title = '') => ({ title, text, hidden: false });

// Trevor (2026-10-24): players write notes on each seat from their grim, as the Storyteller
// keeps notes per player; several titled ones per seat since 2026-10-26.
describe("a player's notes on the seats of their grim", () => {
	it('adds, edits and deletes notes one seat at a time', () => {
		let notes = withSeatNote({}, 's1', note('Claims Chef: 1', 'Claim'));
		notes = withSeatNote(notes, 's1', note('Pinged Ana'));
		notes = withSeatNote(notes, 's2', note('Quiet all day'));
		notes = withSeatNote(notes, 's1', { noteId: 'n1', ...note('Claims Chef: 0', 'Claim') });
		expect(notes).toEqual({
			s1: [
				{ noteId: 'n1', title: 'Claim', text: 'Claims Chef: 0', hidden: false },
				{ noteId: 'n2', title: '', text: 'Pinged Ana', hidden: false }
			],
			s2: [{ noteId: 'n1', title: '', text: 'Quiet all day', hidden: false }]
		});
		expect(withoutSeatNote(notes, 's1', 'n1').s1.map((n) => n.noteId)).toEqual(['n2']);
		expect(withoutSeatNote(notes, 's2', 'n1')).not.toHaveProperty('s2');
		// A note emptied of everything is dropped.
		expect(withSeatNote(notes, 's2', { noteId: 'n1', ...note('  ') })).not.toHaveProperty('s2');
	});

	it('keeps only the newest seats a room could hold', () => {
		let notes: SeatNotes = {};
		for (let i = 0; i < 45; i++) notes = withSeatNote(notes, `s${i}`, note('x'));
		expect(Object.keys(notes)).toHaveLength(40);
		expect(notes).not.toHaveProperty('s0');
	});

	it("reads a version 1 seat's one note as its untitled first note", () => {
		expect(parseSeatNotes({ schemaVersion: 1, notes: { s1: 'a', s2: 3, s3: ' ' } })).toEqual({
			s1: [{ noteId: 'n1', title: '', text: 'a', hidden: false }]
		});
	});

	it('reads only notes saved with a known version', () => {
		const saved = { noteId: 'n1', title: 'T', text: 'a', hidden: true };
		expect(
			parseSeatNotes({ schemaVersion: SEAT_NOTES_VERSION, notes: { s1: [saved, 'x'], s2: 3 } })
		).toEqual({ s1: [saved] });
		expect(parseSeatNotes({ schemaVersion: 99, notes: { s1: [saved] } })).toEqual({});
		expect(parseSeatNotes({ s1: 'a' })).toEqual({});
		expect(parseSeatNotes('x')).toEqual({});
	});
});
