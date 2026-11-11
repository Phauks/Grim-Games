import { describe, expect, it } from 'vitest';
import {
	addNote,
	deleteNote,
	emptyNotebook,
	isBlankNote,
	readNotebook,
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

	it('drops blank notes', () => {
		const old = {
			schemaVersion: 6,
			scriptKey: 'edition:bmr',
			notes: [
				{ noteId: 'n1', title: '', text: ' ', hidden: false },
				{ noteId: 'n2', title: 'Bluff', text: '', hidden: false }
			],
			updatedAt: 1
		};
		expect(readNotebook(old)?.notes).toEqual([
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
		expect(readNotebook(JSON.parse(JSON.stringify(book)))).toEqual(book);
		expect(readNotebook({ schemaVersion: 99, scriptKey: 'edition:tb' })).toBeUndefined();
		expect(readNotebook('nope')).toBeUndefined();
		expect(readNotebook({ schemaVersion: 4 })).toBeUndefined();
		expect(readNotebook({ schemaVersion: 5, scriptKey: 'edition:tb', notes: [] })).toBeUndefined();
	});

	it('keeps each note hidden or shown on its own', () => {
		const book = updateNote(oneNote(5), 'n1', { title: 'Evil team', hidden: true });
		expect(book.notes[0].hidden).toBe(true);
		expect(addNote(book).book.notes[1].hidden).toBe(false);
		expect(readNotebook(JSON.parse(JSON.stringify(book)))).toEqual(book);
	});
});
