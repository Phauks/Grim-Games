import { describe, expect, it } from 'vitest';
import { parseSeatNotes, SEAT_NOTES_VERSION, withSeatNote } from './seat-notes.ts';

// Trevor (2026-10-24): players write a note on each seat from their grim, as the Storyteller
// keeps a note per player.
describe("a player's notes on the seats of their grim", () => {
	it('sets, replaces and clears one seat at a time', () => {
		let notes = withSeatNote({}, 's1', 'Claims Chef: 1');
		notes = withSeatNote(notes, 's2', 'Quiet all day');
		notes = withSeatNote(notes, 's1', 'Claims Chef: 0');
		expect(notes).toEqual({ s1: 'Claims Chef: 0', s2: 'Quiet all day' });
		expect(withSeatNote(notes, 's2', '  ')).toEqual({ s1: 'Claims Chef: 0' });
	});

	it('keeps only the newest notes a room could hold', () => {
		let notes = {};
		for (let i = 0; i < 45; i++) notes = withSeatNote(notes, `s${i}`, 'x');
		expect(Object.keys(notes)).toHaveLength(40);
		expect(notes).not.toHaveProperty('s0');
	});

	it('reads only notes saved with a known version', () => {
		expect(
			parseSeatNotes({ schemaVersion: SEAT_NOTES_VERSION, notes: { s1: 'a', s2: 3 } })
		).toEqual({ s1: 'a' });
		expect(parseSeatNotes({ schemaVersion: 99, notes: { s1: 'a' } })).toEqual({});
		expect(parseSeatNotes({ s1: 'a' })).toEqual({});
		expect(parseSeatNotes('x')).toEqual({});
	});
});
