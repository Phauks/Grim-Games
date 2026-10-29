import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { seatsForCount, surplusSeats } from './surplus-seats.ts';

describe('surplusSeats', () => {
	it('takes the latest empty seats away down to the player count', () => {
		const { session, seats } = newGame(40);
		const extra = surplusSeats(session.game, 10);
		expect(extra).toHaveLength(30);
		expect(extra[0]).toBe(seats[39]);
		expect(extra).not.toContain(seats[9]);
	});

	it('keeps seats with a player name or a character', () => {
		const { session: fresh, ctx, seats } = newGame(6);
		const session = run(
			fresh,
			ctx,
			{ type: 'RenameSeat', seatId: seats[5], playerName: 'Ana' },
			{ type: 'AssignCharacter', seatId: seats[4], characterId: 'chef' }
		);
		expect(surplusSeats(session.game, 3)).toEqual([seats[3], seats[2], seats[1]]);
	});

	it('removes nothing when the count is not lower', () => {
		const { session } = newGame(8);
		expect(surplusSeats(session.game, 8)).toEqual([]);
		expect(surplusSeats(session.game, 12)).toEqual([]);
	});
});

describe('seatsForCount', () => {
	it('adds a placeholder for each seat still to add', () => {
		const { session, seats } = newGame(5);
		const planned = seatsForCount(session.game, 8);
		expect(planned).toHaveLength(8);
		expect(planned.slice(0, 5).map((s) => s.seatId)).toEqual(seats);
		expect(new Set(planned.map((s) => s.seatId)).size).toBe(8);
	});

	it('drops the seats a lower count takes away, keeping named ones', () => {
		const { session: fresh, ctx, seats } = newGame(6);
		const session = run(fresh, ctx, { type: 'RenameSeat', seatId: seats[5], playerName: 'Ana' });
		const planned = seatsForCount(session.game, 3);
		expect(planned.map((s) => s.seatId)).toEqual([seats[0], seats[1], seats[5]]);
		expect(planned[2].playerName).toBe('Ana');
	});

	it('keeps every seat that holds a player even below the count', () => {
		const { session: fresh, ctx, seats } = newGame(3);
		const session = run(
			fresh,
			ctx,
			...seats.map((seatId, i) => ({ type: 'RenameSeat' as const, seatId, playerName: `P${i}` }))
		);
		expect(seatsForCount(session.game, 2)).toHaveLength(3);
	});
});
