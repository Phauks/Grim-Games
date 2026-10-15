import { describe, expect, it } from 'vitest';
import {
	addNote,
	deleteNote,
	emptyNotebook,
	MAX_SEATS,
	migrateNotebook,
	MIN_SEATS,
	scriptKey,
	setSeatCount,
	toggleMe,
	updateNote,
	updateSeat
} from './notebook.ts';

describe('player notebook', () => {
	it('keys official editions by id and custom scripts by name', () => {
		expect(scriptKey({ edition: 'tb', name: 'Trouble Brewing' })).toBe('edition:tb');
		expect(scriptKey({ name: ' My Script ' })).toBe('script:my script');
	});

	it('keeps seat data when seats are added or removed, and never reuses an id', () => {
		let book = emptyNotebook('edition:tb', 6, 0);
		book = updateSeat(book, 's2', { name: 'Alex', guess: 'empath' });
		book = toggleMe(book, 's6');
		book = setSeatCount(book, 5);
		expect(book.seats).toHaveLength(5);
		expect(book.me).toBeUndefined();
		expect(book.seats[1]).toMatchObject({ name: 'Alex', guess: 'empath' });
		book = setSeatCount(book, 7);
		expect(book.seats.map((s) => s.seatId)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
		expect(setSeatCount(book, 99).seats).toHaveLength(MAX_SEATS);
		expect(setSeatCount(book, 1).seats).toHaveLength(MIN_SEATS);
	});

	it('only dead players can have spent their vote', () => {
		let book = emptyNotebook('edition:tb', 5, 0);
		book = updateSeat(book, 's1', { dead: true, ghostVoteUsed: true });
		expect(book.seats[0].ghostVoteUsed).toBe(true);
		book = updateSeat(book, 's1', { dead: false });
		expect(book.seats[0].ghostVoteUsed).toBe(false);
	});

	it('reads a saved v1 notebook and refuses data it does not understand', () => {
		const saved = JSON.parse(JSON.stringify(toggleMe(emptyNotebook('edition:tb', 5, 1), 's3')));
		expect(migrateNotebook(saved)).toEqual(saved);
		expect(migrateNotebook({ ...saved, schemaVersion: 3 })).toBeUndefined();
		expect(migrateNotebook('nonsense')).toBeUndefined();
		const damaged = migrateNotebook({
			schemaVersion: 2,
			scriptKey: 'edition:tb',
			seats: [{ name: 3 }]
		});
		expect(damaged?.seats).toHaveLength(MIN_SEATS);
		expect(damaged?.seats[0].name).toBe('');
	});

	it('moves a v1 notes pad into one untitled note', () => {
		const v1 = {
			schemaVersion: 1,
			scriptKey: 'edition:tb',
			seats: [],
			notes: 'Sam: Chef 1',
			updatedAt: 5
		};
		expect(migrateNotebook(v1)?.notes).toEqual([{ noteId: 'n1', title: '', text: 'Sam: Chef 1' }]);
	});

	it('adds, edits and deletes titled notes with ids that never repeat', () => {
		let book = emptyNotebook('edition:tb', 5, 0);
		const added = addNote(book);
		book = updateNote(added.book, added.noteId, { title: 'My bluff', text: 'Chef: 0' });
		expect(book.notes.map((n) => [n.noteId, n.title])).toEqual([
			['n1', ''],
			['n2', 'My bluff']
		]);
		book = deleteNote(book, 'n1');
		expect(addNote(book).noteId).toBe('n3');
		expect(migrateNotebook(JSON.parse(JSON.stringify(book)))?.notes).toEqual(book.notes);
	});
});
