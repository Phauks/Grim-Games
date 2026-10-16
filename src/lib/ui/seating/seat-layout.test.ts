import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SEAT_LAYOUT,
	gapPoints,
	isDefaultLayout,
	nextGap,
	parseSeatLayout,
	pruneLayout,
	seatPoints,
	seatTokenSize,
	withGap,
	withoutPlaced,
	withPlaced,
	towardsMiddle,
	withShape
} from './seat-layout.ts';

const seats = ['a', 'b', 'c', 'd'];
const square = { width: 400, height: 400 };
const wide = { width: 800, height: 400 };

describe('seatPoints', () => {
	it('puts the first seat at the top and runs clockwise round an oval', () => {
		const [a, b, c] = seatPoints(seats, DEFAULT_SEAT_LAYOUT, square);
		expect(a).toEqual({ x: 50, y: 9 });
		expect(b.x).toBeCloseTo(91);
		expect(b.y).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(91);
	});

	it('keeps a circle round on a wide board', () => {
		const circle = withShape(DEFAULT_SEAT_LAYOUT, 'circle');
		const [, b] = seatPoints(seats, circle, wide);
		// 41% of the 400px height is 164px, which is 20.5% of the 800px width.
		expect(b.x).toBeCloseTo(70.5);
		expect(seatPoints(seats, DEFAULT_SEAT_LAYOUT, wide)[1].x).toBeCloseTo(91);
	});

	it('leaves empty places on the ring for gaps', () => {
		// Four seats and a gap of two after "b": six places, and "c" takes the fifth.
		const layout = withGap(DEFAULT_SEAT_LAYOUT, 'b', 2);
		const [, , c] = seatPoints(seats, layout, square);
		const angle = (4 / 6) * 2 * Math.PI - Math.PI / 2;
		expect(c.x).toBeCloseTo(50 + 41 * Math.cos(angle));
		expect(c.y).toBeCloseTo(50 + 41 * Math.sin(angle));
	});

	it('draws a hand-placed seat where it was put, without moving the others', () => {
		const layout = withPlaced(DEFAULT_SEAT_LAYOUT, 'b', { x: 30, y: 40 });
		const points = seatPoints(seats, layout, square);
		expect(points[1]).toEqual({ x: 30, y: 40 });
		expect(points[2]).toEqual(seatPoints(seats, DEFAULT_SEAT_LAYOUT, square)[2]);
		expect(seatPoints(seats, withoutPlaced(layout, 'b'), square)).toEqual(
			seatPoints(seats, DEFAULT_SEAT_LAYOUT, square)
		);
	});
});

describe('gaps', () => {
	it('cycles 0 to 3 and back to 0', () => {
		let layout = DEFAULT_SEAT_LAYOUT;
		const seen = [];
		for (let i = 0; i < 4; i++) {
			layout = withGap(layout, 'a', nextGap(layout, 'a'));
			seen.push(layout.gaps.a ?? 0);
		}
		expect(seen).toEqual([1, 2, 3, 0]);
		expect(layout.gaps).toEqual({});
	});

	it('puts each gap control midway between a seat and the next', () => {
		const [ab] = gapPoints(seats, DEFAULT_SEAT_LAYOUT, square);
		const angle = (0.5 / 4) * 2 * Math.PI - Math.PI / 2;
		expect(ab.x).toBeCloseTo(50 + 41 * Math.cos(angle));
		const [inside] = gapPoints(seats, DEFAULT_SEAT_LAYOUT, square, 0.25);
		expect(inside.x).toBeCloseTo(50 + 41 * 0.75 * Math.cos(angle));
	});

	it('sizes tokens between 44px and 96px, smaller with more seats', () => {
		const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
		expect(seatTokenSize(ids(30), DEFAULT_SEAT_LAYOUT, { width: 320, height: 400 })).toBe(44);
		expect(seatTokenSize(ids(5), DEFAULT_SEAT_LAYOUT, { width: 1200, height: 900 })).toBe(96);
		expect(seatTokenSize(ids(8), DEFAULT_SEAT_LAYOUT, { width: 0, height: 0 })).toBe(56);
	});

	it('makes tokens smaller as gaps take up the ring', () => {
		const board = { width: 360, height: 600 };
		const many = Array.from({ length: 12 }, (_, i) => `s${i}`);
		const gapped = withGap(withGap(DEFAULT_SEAT_LAYOUT, 's0', 3), 's5', 3);
		expect(seatTokenSize(many, gapped, board)).toBeLessThan(
			seatTokenSize(many, DEFAULT_SEAT_LAYOUT, board)
		);
		expect(seatTokenSize(many, gapped, board)).toBeGreaterThanOrEqual(44);
	});
});

describe('saving', () => {
	it('keeps placed seats inside the board and rounds them', () => {
		expect(withPlaced(DEFAULT_SEAT_LAYOUT, 'a', { x: -20, y: 50.123 }).placed.a).toEqual({
			x: 6,
			y: 50.1
		});
	});

	it('forgets seats that left the table', () => {
		const layout = withPlaced(withGap(DEFAULT_SEAT_LAYOUT, 'gone', 1), 'gone', { x: 10, y: 10 });
		expect(isDefaultLayout(pruneLayout(layout, seats))).toBe(true);
	});

	it('reads back what it saved and drops anything malformed', () => {
		const layout = withPlaced(withGap(withShape(DEFAULT_SEAT_LAYOUT, 'circle'), 'a', 2), 'b', {
			x: 20,
			y: 30
		});
		expect(parseSeatLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
		expect(
			parseSeatLayout({ shape: 'hexagon', gaps: { a: 'x', b: 9 }, placed: { c: { x: 1 } } })
		).toEqual({ shape: 'oval', gaps: { b: 3 }, placed: {} });
		expect(parseSeatLayout(null)).toEqual(DEFAULT_SEAT_LAYOUT);
	});
});

describe('towardsMiddle', () => {
	it('lines reminders up from a seat towards the middle', () => {
		const [near, far] = towardsMiddle({ x: 50, y: 10 }, square, [40, 80]);
		// 40px on a 400px board is 10%, straight down from the top seat.
		expect(near.x).toBeCloseTo(50);
		expect(near.y).toBeCloseTo(20);
		expect(far.y).toBeCloseTo(30);
		expect(towardsMiddle({ x: 50, y: 50 }, square, [40])[0].y).toBeCloseTo(60);
	});
});
