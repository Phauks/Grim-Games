import { describe, expect, it } from 'vitest';
import {
	addNote,
	deleteNote,
	emptyNotebook,
	MAX_SEATS,
	migrateNotebook,
	MIN_SEATS,
	scriptKey,
	setLayout,
	setSeatCount,
	toggleClaim,
	updateNote,
	updateSeat
} from './notebook.ts';
import {
	DEFAULT_SEAT_LAYOUT,
	withGap,
	withPlaced,
	withShape
} from '#lib/ui/seating/seat-layout.ts';

describe('player notebook', () => {
	it('keys official editions by id and custom scripts by name', () => {
		expect(scriptKey({ edition: 'tb', name: 'Trouble Brewing' })).toBe('edition:tb');
		expect(scriptKey({ name: ' My Script ' })).toBe('script:my script');
	});

	it('keeps seat data when seats are added or removed, and never reuses an id', () => {
		let book = emptyNotebook('edition:tb', 6, 0);
		book = updateSeat(book, 's2', { name: 'Alex', claims: ['empath'] });
		book = setSeatCount(book, 5);
		expect(book.seats).toHaveLength(5);
		expect(book.seats[1]).toMatchObject({ name: 'Alex', claims: ['empath'] });
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

	it('reads a saved notebook and refuses data it does not understand', () => {
		const saved = JSON.parse(
			JSON.stringify(toggleClaim(emptyNotebook('edition:tb', 5, 1), 's3', 'chef'))
		);
		expect(migrateNotebook(saved)).toEqual(saved);
		expect(migrateNotebook({ ...saved, schemaVersion: 5 })).toBeUndefined();
		expect(migrateNotebook('nonsense')).toBeUndefined();
		const damaged = migrateNotebook({
			schemaVersion: 2,
			scriptKey: 'edition:tb',
			seats: [{ name: 3 }]
		});
		expect(damaged?.seats).toHaveLength(MIN_SEATS);
		expect(damaged?.seats[0].name).toBe('');
	});

	it('a seat can claim several characters, toggled one at a time', () => {
		let book = emptyNotebook('edition:tb', 5, 0);
		book = toggleClaim(book, 's1', 'chef');
		book = toggleClaim(book, 's1', 'empath');
		expect(book.seats[0].claims).toEqual(['chef', 'empath']);
		book = toggleClaim(book, 's1', 'chef');
		expect(book.seats[0].claims).toEqual(['empath']);
	});

	it("turns an older notebook's single guess into a claim and drops 'This is me'", () => {
		const v3 = {
			schemaVersion: 3,
			scriptKey: 'edition:tb',
			seats: [{ seatId: 's1', name: 'Sam', guess: 'chef' }, { seatId: 's2' }],
			me: 's1',
			notes: []
		};
		const book = migrateNotebook(v3)!;
		expect(book.seats.map((s) => s.claims)).toEqual([['chef'], [], [], [], []]);
		expect(book).not.toHaveProperty('me');
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

	it('keeps the seat layout, forgetting seats that have left', () => {
		let book = emptyNotebook('edition:tb', 6, 0);
		book = setLayout(
			book,
			withPlaced(withGap(withShape(book.layout, 'circle'), 's2', 2), 's6', { x: 20, y: 80 })
		);
		expect(migrateNotebook(JSON.parse(JSON.stringify(book)))?.layout).toEqual(book.layout);
		book = setSeatCount(book, 5);
		expect(book.layout).toEqual({ shape: 'circle', gaps: { s2: 2 }, placed: {} });
	});

	it('gives v2 notebooks the default ring and repairs a damaged layout', () => {
		const v2 = { schemaVersion: 2, scriptKey: 'edition:tb', seats: [], notes: [] };
		expect(migrateNotebook(v2)?.layout).toEqual(DEFAULT_SEAT_LAYOUT);
		const damaged = migrateNotebook({ ...v2, schemaVersion: 3, layout: { shape: 7, gaps: 'x' } });
		expect(damaged?.layout).toEqual(DEFAULT_SEAT_LAYOUT);
	});
});
