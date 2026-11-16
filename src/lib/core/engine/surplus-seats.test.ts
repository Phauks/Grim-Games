import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { surplusSeats } from './surplus-seats.ts';

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
