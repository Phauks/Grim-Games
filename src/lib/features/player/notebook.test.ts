import { describe, expect, it } from 'vitest';
import {
	addNote,
	deleteNote,
	emptyNotebook,
	isBlankNote,
	migrateNotebook,
	NOTEBOOK_VERSION,
	scriptKey,
	updateNote
} from './notebook.ts';

/** A notebook holding one empty note, `n1`, as "+ New note" leaves it. */
const oneNote = (now = 0) => addNote(emptyNotebook('edition:tb', now)).book;

describe('player notebook', () => {
	it('keys official editions by id and custom scripts by name', () => {
		expect(scriptKey({ edition: 'tb', name: 'Trouble Brewing' })).toBe('edition:tb');
		expect(scriptKey({ name: ' My Script ' })).toBe('script:my script');
	});

	it('starts with no notes', () => {
		expect(emptyNotebook('edition:tb', 0)).toEqual({
			schemaVersion: NOTEBOOK_VERSION,
			scriptKey: 'edition:tb',
			notes: [],
			updatedAt: 0
		});
	});

	it('drops the blank note older builds started every notebook with', () => {
		const old = {
			schemaVersion: 6,
			scriptKey: 'edition:bmr',
			notes: [
				{ noteId: 'n1', title: '', text: ' ', hidden: false },
				{ noteId: 'n2', title: 'Bluff', text: '', hidden: false }
			],
			updatedAt: 1
		};
		expect(migrateNotebook(old)?.notes).toEqual([
			{ noteId: 'n2', title: 'Bluff', text: '', hidden: false }
		]);
		expect(isBlankNote({ title: ' ', text: '\n' })).toBe(true);
		expect(isBlankNote({ title: '', text: 'x' })).toBe(false);
	});

	it('adds, edits and deletes titled notes with ids that never repeat', () => {
		let book = oneNote();
		const first = addNote(book);
		book = updateNote(first.book, first.noteId, { title: 'Bluffs', text: 'Chef, Monk' });
		expect(book.notes[1]).toEqual({
			noteId: 'n2',
			title: 'Bluffs',
			text: 'Chef, Monk',
			hidden: false
		});
		book = deleteNote(book, 'n1');
		const second = addNote(book);
		expect(second.noteId).toBe('n3');
	});

	it('reads a saved notebook and refuses data it does not understand', () => {
		const book = updateNote(oneNote(5), 'n1', { title: 'Evil team' });
		expect(migrateNotebook(JSON.parse(JSON.stringify(book)))).toEqual(book);
		expect(migrateNotebook({ schemaVersion: 99, scriptKey: 'edition:tb' })).toBeUndefined();
		expect(migrateNotebook('nope')).toBeUndefined();
		expect(migrateNotebook({ schemaVersion: 4 })).toBeUndefined();
	});

	it('keeps each note hidden or shown on its own', () => {
		const book = updateNote(oneNote(5), 'n1', { title: 'Evil team', hidden: true });
		expect(book.notes[0].hidden).toBe(true);
		expect(addNote(book).book.notes[1].hidden).toBe(false);
		expect(migrateNotebook(JSON.parse(JSON.stringify(book)))).toEqual(book);
	});

	it('hides every note from before v6 when the old Hide note contents setting was on', () => {
		const old = {
			schemaVersion: 5,
			scriptKey: 'edition:tb',
			notes: [{ noteId: 'n1', title: 'A', text: 'b' }],
			updatedAt: 1
		};
		expect(migrateNotebook(old, true)?.notes[0].hidden).toBe(true);
		expect(migrateNotebook(old, false)?.notes[0].hidden).toBe(false);
		// From v6 on each note decides; the old setting no longer applies.
		const v6 = { ...old, schemaVersion: 6, notes: [{ ...old.notes[0], hidden: false }] };
		expect(migrateNotebook(v6, true)?.notes[0].hidden).toBe(false);
	});

	it('moves a v1 notes pad into one untitled note', () => {
		expect(
			migrateNotebook({ schemaVersion: 1, scriptKey: 'edition:tb', notes: 'hi' })?.notes
		).toEqual([{ noteId: 'n1', title: '', text: 'hi', hidden: false }]);
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
				{ noteId: 'n1', title: 'Mine', text: 'x', hidden: false },
				{ noteId: 'n2', title: 'Seat 1 · Alex', text: 'Pinged me', hidden: false },
				{ noteId: 'n3', title: 'Seat 3', text: 'Quiet', hidden: false }
			],
			updatedAt: 7
		});
	});
});
