import { describe, expect, it } from 'vitest';
import {
	addNote,
	deleteNote,
	emptyNotebook,
	migrateNotebook,
	NOTEBOOK_VERSION,
	scriptKey,
	updateNote
} from './notebook.ts';

describe('player notebook', () => {
	it('keys official editions by id and custom scripts by name', () => {
		expect(scriptKey({ edition: 'tb', name: 'Trouble Brewing' })).toBe('edition:tb');
		expect(scriptKey({ name: ' My Script ' })).toBe('script:my script');
	});

	it('starts with one empty note', () => {
		expect(emptyNotebook('edition:tb', 0)).toEqual({
			schemaVersion: NOTEBOOK_VERSION,
			scriptKey: 'edition:tb',
			notes: [{ noteId: 'n1', title: '', text: '' }],
			updatedAt: 0
		});
	});

	it('adds, edits and deletes titled notes with ids that never repeat', () => {
		let book = emptyNotebook('edition:tb', 0);
		const first = addNote(book);
		book = updateNote(first.book, first.noteId, { title: 'Bluffs', text: 'Chef, Monk' });
		expect(book.notes[1]).toEqual({ noteId: 'n2', title: 'Bluffs', text: 'Chef, Monk' });
		book = deleteNote(book, 'n1');
		const second = addNote(book);
		expect(second.noteId).toBe('n3');
	});

	it('reads a saved notebook and refuses data it does not understand', () => {
		const book = updateNote(emptyNotebook('edition:tb', 5), 'n1', { title: 'Evil team' });
		expect(migrateNotebook(JSON.parse(JSON.stringify(book)))).toEqual(book);
		expect(migrateNotebook({ schemaVersion: 99, scriptKey: 'edition:tb' })).toBeUndefined();
		expect(migrateNotebook('nope')).toBeUndefined();
		expect(migrateNotebook({ schemaVersion: 4 })).toBeUndefined();
	});

	it('moves a v1 notes pad into one untitled note', () => {
		expect(
			migrateNotebook({ schemaVersion: 1, scriptKey: 'edition:tb', notes: 'hi' })?.notes
		).toEqual([{ noteId: 'n1', title: '', text: 'hi' }]);
	});

	it('keeps notes written on seats in v1 to v4 as titled notes, dropping the circle', () => {
		const book = migrateNotebook({
			schemaVersion: 4,
			scriptKey: 'edition:tb',
			seats: [
				{ seatId: 's1', name: 'Alex', claims: ['empath'], dead: true, note: 'Pinged me' },
				{ seatId: 's2', name: '', claims: [], note: '   ' },
				{ seatId: 's3', name: '', claims: [], note: 'Quiet' }
			],
			notes: [{ noteId: 'n1', title: 'Mine', text: 'x' }],
			layout: { shape: 'oval', gaps: {}, placed: {} },
			updatedAt: 7
		});
		expect(book).toEqual({
			schemaVersion: NOTEBOOK_VERSION,
			scriptKey: 'edition:tb',
			notes: [
				{ noteId: 'n1', title: 'Mine', text: 'x' },
				{ noteId: 'n2', title: 'Seat 1 · Alex', text: 'Pinged me' },
				{ noteId: 'n3', title: 'Seat 3', text: 'Quiet' }
			],
			updatedAt: 7
		});
	});
});
