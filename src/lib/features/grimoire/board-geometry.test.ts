import { describe, expect, it } from 'vitest';
import {
	avoidBoxes,
	cornerObstacles,
	keepClear,
	nameBoxes,
	rimToward,
	toPercent,
	toPx
} from './board-geometry.ts';

const board = { width: 400, height: 200 };

describe('toPx and toPercent', () => {
	it('convert between % of the board and pixels', () => {
		expect(toPx({ x: 50, y: 25 }, board)).toEqual({ x: 200, y: 50 });
		expect(toPercent({ x: 200, y: 50 }, board)).toEqual({ x: 50, y: 25 });
	});
});

describe('rimToward', () => {
	it('starts a tether on the rim facing the target', () => {
		// A 40px token at (100, 100) facing right: the rim is 20px along.
		const at = rimToward({ x: 25, y: 50 }, { x: 75, y: 50 }, board, 40);
		expect(toPx(at, board)).toEqual({ x: 120, y: 100 });
	});

	it('stays on the target when it is inside the token', () => {
		const at = rimToward({ x: 25, y: 50 }, { x: 26, y: 50 }, board, 40);
		expect(toPx(at, board).x).toBeCloseTo(104);
	});

	it('keeps the seat when the target is on it', () => {
		const seat = { x: 25, y: 50 };
		expect(rimToward(seat, seat, board, 40)).toBe(seat);
	});
});

describe('nameBoxes', () => {
	const input = { names: ['Ana', 'Seat 2'], size: 60, unit: 8, rootFont: 16, board };

	it('puts a name beneath a token that has room', () => {
		const [ana] = nameBoxes({
			...input,
			seats: [
				{ x: 25, y: 30 },
				{ x: 75, y: 30 }
			]
		});
		expect(ana.place).toBe('below');
		expect(ana.box.x).toBe(100);
		expect(ana.box.y).toBeGreaterThan(60);
	});

	it('caps a long name at the token plus two units', () => {
		const [long] = nameBoxes({
			...input,
			names: ['A very long player name indeed'],
			seats: [{ x: 50, y: 30 }]
		});
		expect(long.box.w).toBe(60 + 16);
	});

	it('is empty before the board is measured', () => {
		expect(nameBoxes({ ...input, seats: [], board: { width: 0, height: 0 } })).toEqual([]);
	});
});

describe('cornerObstacles', () => {
	it('gives each token, lowered for its name pill, and its name box', () => {
		const name = { x: 1, y: 2, w: 3, h: 4 };
		const boxes = cornerObstacles(
			[
				{ x: 50, y: 50 },
				{ x: 0, y: 0 }
			],
			[{ box: name }],
			40,
			0,
			board
		);
		expect(boxes).toEqual([{ x: 200, y: 102, w: 40, h: 44 }, name, { x: 0, y: 2, w: 40, h: 44 }]);
	});
});

describe('avoidBoxes', () => {
	const base = { centre: { x: 100, y: 100 }, size: 40, nameOffset: 0, dead: false, note: false };

	it('avoids the name box of a seat with no character', () => {
		const name = { x: 100, y: 130, w: 50, h: 16 };
		expect(avoidBoxes({ ...base, hasFace: false, name })).toEqual([name]);
	});

	it('avoids the badge on the rim of a seat with a character', () => {
		const [badge] = avoidBoxes({ ...base, hasFace: true, name: undefined });
		expect(badge).toMatchObject({ x: 100, y: 120, w: 36 });
		expect(badge.h).toBeCloseTo(7.2);
	});

	it('also avoids a dead seat’s skull and a note mark', () => {
		const boxes = avoidBoxes({ ...base, hasFace: true, name: undefined, dead: true, note: true });
		expect(boxes).toHaveLength(3);
		expect(boxes[1].x).toBeLessThan(100);
		expect(boxes[2].x).toBeGreaterThan(100);
	});
});

describe('keepClear', () => {
	it('keeps the measured parts clear with a margin', () => {
		const boxes = keepClear({
			centre: { w: 100, h: 40 },
			edge: { w: 60, h: 30 },
			timer: { w: 50, h: 20 },
			title: { w: 80, h: 24 },
			board
		});
		expect(boxes).toEqual([
			{ x: 200, y: 100, w: 112, h: 52 },
			{ x: 30, y: 15, w: 72, h: 42 },
			{ x: 375, y: 10, w: 62, h: 32 },
			{ x: 40, y: 188, w: 92, h: 36 }
		]);
	});

	it('leaves out what is unmeasured, in the middle or hidden', () => {
		expect(
			keepClear({
				centre: { w: 0, h: 0 },
				edge: undefined,
				timer: undefined,
				title: { w: 0, h: 0 },
				board
			})
		).toEqual([]);
	});
});
