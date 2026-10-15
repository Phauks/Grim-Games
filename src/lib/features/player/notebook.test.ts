import { describe, expect, it } from 'vitest';
import {
	emptyNotebook,
	MAX_SEATS,
	migrateNotebook,
	MIN_SEATS,
	scriptKey,
	setSeatCount,
	toggleMe,
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
		expect(migrateNotebook({ ...saved, schemaVersion: 2 })).toBeUndefined();
		expect(migrateNotebook('nonsense')).toBeUndefined();
		const damaged = migrateNotebook({
			schemaVersion: 1,
			scriptKey: 'edition:tb',
			seats: [{ name: 3 }]
		});
		expect(damaged?.seats).toHaveLength(MIN_SEATS);
		expect(damaged?.seats[0].name).toBe('');
	});
});
