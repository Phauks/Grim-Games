import { describe, expect, it } from 'vitest';
import { nameBox, placeNames } from './name-placement.ts';

const board = { width: 400, height: 400 };

describe('placeNames', () => {
	it('puts names on the outside of the table', () => {
		const seats = [
			{ x: 300, y: 80 },
			{ x: 520, y: 300 },
			{ x: 300, y: 520 },
			{ x: 80, y: 300 }
		];
		const places = placeNames({
			seats,
			size: 48,
			widths: [50, 50, 50, 50],
			height: 18,
			obstacles: [],
			board: { width: 600, height: 600 }
		});
		expect(places).toEqual(['above', 'right', 'below', 'left']);
	});

	it('moves a name off a reminder that would cover it', () => {
		const seat = { x: 200, y: 300 };
		const below = nameBox(seat, 'below', 48, 60, 18);
		const places = placeNames({
			seats: [seat],
			size: 48,
			widths: [60],
			height: 18,
			obstacles: [below],
			board
		});
		expect(places[0]).not.toBe('below');
	});

	it('keeps a name on the board at the edge', () => {
		// Right at the top edge: "above" would be off the board.
		const places = placeNames({
			seats: [{ x: 200, y: 26 }],
			size: 48,
			widths: [60],
			height: 18,
			obstacles: [],
			board
		});
		expect(places[0]).not.toBe('above');
	});

	it('keeps names off neighbouring tokens and each other', () => {
		// Two seats side by side near the bottom: their names must not overlap.
		const seats = [
			{ x: 180, y: 360 },
			{ x: 230, y: 360 }
		];
		const places = placeNames({
			seats,
			size: 48,
			widths: [80, 80],
			height: 18,
			obstacles: [],
			board
		});
		const a = nameBox(seats[0], places[0], 48, 80, 18);
		const b = nameBox(seats[1], places[1], 48, 80, 18);
		const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
		expect(apart).toBe(true);
	});
});
