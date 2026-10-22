import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from './commands.ts';
import { recentDeaths, recentRevivals } from './recent-deaths.ts';

const dead = (seatId: string, cause?: string): Command => ({
	type: 'SetDead',
	seatId,
	dead: true,
	...(cause ? { cause } : {})
});

describe('recentDeaths', () => {
	it('before any New day, lists everyone who died, in order, with their cause', () => {
		const { session, ctx, seats } = newGame(6);
		const s = run(session, ctx, dead(seats[3], 'demon'), dead(seats[1]));
		expect(recentDeaths(s.log, s.game)).toEqual([
			{ seatId: seats[3], cause: 'demon' },
			{ seatId: seats[1] }
		]);
	});

	it('starts after the previous day’s execution, so last night’s deaths show at dawn', () => {
		const { session, ctx, seats } = newGame(7);
		const s = run(
			session,
			ctx,
			dead(seats[0], 'demon'), // night 1
			{ type: 'NewDay' }, // day 1 begins
			{ type: 'Execute', seatId: seats[1] }, // day 1 execution
			dead(seats[2], 'demon'), // night 2
			{ type: 'NewDay' } // day 2 begins
		);
		expect(recentDeaths(s.log, s.game)).toEqual([{ seatId: seats[2], cause: 'demon' }]);
		// A death during the day is not announced at dawn (Trevor, 2026-10-18).
		const later = run(s, ctx, dead(seats[4], 'slayer'));
		expect(recentDeaths(later.log, later.game).map((d) => d.seatId)).toEqual([seats[2]]);
	});

	it('without an execution, starts at the previous New day', () => {
		const { session, ctx, seats } = newGame(7);
		const s = run(
			session,
			ctx,
			dead(seats[0], 'demon'),
			{ type: 'NewDay' },
			dead(seats[2], 'demon'),
			{ type: 'NewDay' }
		);
		expect(recentDeaths(s.log, s.game)).toEqual([{ seatId: seats[2], cause: 'demon' }]);
	});

	it('drops players brought back to life and follows a changed cause', () => {
		const { session, ctx, seats } = newGame(6);
		const s = run(
			session,
			ctx,
			dead(seats[0], 'demon'),
			dead(seats[1], 'demon'),
			{ type: 'SetDead', seatId: seats[0], dead: false },
			{ type: 'SetDeathCause', seatId: seats[1], cause: 'other' }
		);
		expect(recentDeaths(s.log, s.game)).toEqual([{ seatId: seats[1], cause: 'other' }]);
	});

	it('never lists an execution or exile, even before the first New day', () => {
		const { session, ctx, seats } = newGame(6);
		const s = run(session, ctx, dead(seats[0], 'demon'), { type: 'Execute', seatId: seats[1] });
		expect(recentDeaths(s.log, s.game)).toEqual([{ seatId: seats[0], cause: 'demon' }]);
	});
});

describe('recentRevivals', () => {
	const alive = (seatId: string): Command => ({ type: 'SetDead', seatId, dead: false });

	it('lists players dead before the night and alive at dawn, in order', () => {
		const { session, ctx, seats } = newGame(7);
		const s = run(
			session,
			ctx,
			dead(seats[0], 'demon'), // night 1
			dead(seats[1], 'demon'),
			{ type: 'NewDay' }, // day 1
			{ type: 'Execute', seatId: seats[2] },
			alive(seats[1]), // night 2: the Professor, say
			alive(seats[0]),
			{ type: 'NewDay' } // day 2
		);
		expect(recentRevivals(s.log, s.game)).toEqual([seats[1], seats[0]]);
		// Still the night just ended's during the day; a revival in the day is not announced.
		const later = run(s, ctx, alive(seats[2]));
		expect(recentRevivals(later.log, later.game)).toEqual([seats[1], seats[0]]);
	});

	it('leaves out a player who died and came back the same night, or died again', () => {
		const { session, ctx, seats } = newGame(7);
		const s = run(
			session,
			ctx,
			dead(seats[0], 'demon'),
			{ type: 'NewDay' },
			dead(seats[1], 'demon'), // night 2
			alive(seats[1]),
			alive(seats[0]),
			dead(seats[0], 'demon'),
			{ type: 'NewDay' }
		);
		expect(recentRevivals(s.log, s.game)).toEqual([]);
	});
});
