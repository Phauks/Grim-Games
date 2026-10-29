import { describe, expect, it } from 'vitest';
import {
	candleHeights,
	NEIGHBOUR_GAP,
	parseSeatPresence,
	seatCandles,
	seatConnections,
	seatPresence
} from './seat-presence.ts';

// The candles beside Setup on players' phones (Trevor, 2026-10-28: one per seat, showing
// "the player count and connection", own seat in red, heights "randomized, but always
// slightly different from its neighbors", more players than seats as "just the number").

const members = [
	{ memberId: 'a', seatId: 's1' },
	{ memberId: 'b', seatId: 's2' },
	{ memberId: 'c' },
	{ memberId: 'd' }
];

describe('seatPresence', () => {
	it('splits seated phones into here and away, and counts connected phones with no seat', () => {
		const here = new Set(['a', 'c']);
		expect(seatPresence(members, (id) => here.has(id))).toEqual({
			here: ['s1'],
			away: ['s2'],
			unseated: 1
		});
	});

	it('reads only what it can trust from the room', () => {
		expect(parseSeatPresence(undefined)).toBeUndefined();
		expect(parseSeatPresence({ here: ['s1', 3], away: 'x', unseated: -2 })).toEqual({
			here: ['s1'],
			away: [],
			unseated: 0
		});
	});
});

describe('seatCandles', () => {
	const seats = [
		{ seatId: 's1', playerName: 'Ann' },
		{ seatId: 's2', playerName: 'Bo' },
		{ seatId: 's3' }
	];

	it('lights a connected seat, embers an away one and leaves an empty one unlit', () => {
		const candles = seatCandles(seats, { here: ['s1'], away: ['s2'], unseated: 0 }, 's2');
		expect(candles.map((c) => c.state)).toEqual(['lit', 'away', 'empty']);
		expect(candles.map((c) => c.mine)).toEqual([false, true, false]);
	});

	it('lights the seats with a player name when no room says who is connected', () => {
		expect(seatCandles(seats, undefined).map((c) => c.state)).toEqual(['lit', 'lit', 'empty']);
	});
});

describe('seatConnections', () => {
	// A tap on the candles lists who is connected (Trevor, 2026-10-29: "clicking the candle
	// modal should show you which players have connected").
	it('lists every seat in order with its number, name and connection', () => {
		const seats = [{ seatId: 's1', playerName: 'Ann' }, { seatId: 's2' }, { seatId: 's3' }];
		expect(seatConnections(seats, { here: ['s1'], away: ['s3'], unseated: 1 })).toEqual([
			{ seatId: 's1', seatNumber: 1, playerName: 'Ann', state: 'lit' },
			{ seatId: 's2', seatNumber: 2, playerName: undefined, state: 'empty' },
			{ seatId: 's3', seatNumber: 3, playerName: undefined, state: 'away' }
		]);
	});
});

describe('candleHeights', () => {
	it('never puts two neighbours within a fifth of each other, and stays between 0 and 1', () => {
		for (let game = 0; game < 200; game++) {
			const heights = candleHeights(`game-${game}`, 20);
			heights.forEach((h, i) => {
				expect(h).toBeGreaterThanOrEqual(0);
				expect(h).toBeLessThanOrEqual(1);
				if (i > 0) expect(Math.abs(h - heights[i - 1])).toBeGreaterThanOrEqual(NEIGHBOUR_GAP);
			});
		}
	});

	it('keeps a game its candles, and gives another game new ones', () => {
		expect(candleHeights('s1 s2 s3', 3)).toEqual(candleHeights('s1 s2 s3', 3));
		expect(candleHeights('s1 s2 s3', 3)).not.toEqual(candleHeights('t1 t2 t3', 3));
	});
});
