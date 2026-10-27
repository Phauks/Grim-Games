import { describe, expect, it } from 'vitest';
import {
	orderAround,
	keepInside,
	DEFAULT_SEAT_LAYOUT,
	isDefaultLayout,
	parseSeatLayout,
	pruneLayout,
	seatPoints,
	seatTokenSize,
	withGap,
	withoutPlaced,
	withPlaced,
	towardsMiddle,
	withShape,
	followSeating,
	isRotation,
	spreadEvenly,
	boardAspect,
	parseAspect,
	fitAspect,
	centredIn
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

	it('spaces seats an equal distance apart round an oval, not at equal angles', () => {
		// Trevor, 2026-10-17: on a wide board equal angles bunched seats at the ends.
		const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const px = seatPoints(ids, DEFAULT_SEAT_LAYOUT, wide).map((p) => ({
			x: (p.x / 100) * wide.width,
			y: (p.y / 100) * wide.height
		}));
		const gaps = px.map((p, i) => {
			const q = px[(i + 1) % px.length];
			return Math.hypot(p.x - q.x, p.y - q.y);
		});
		expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.1);
		expect(px[0]).toEqual({ x: 400, y: expect.closeTo(36) });
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
	it('keeps gaps between 0 and 3', () => {
		expect(withGap(DEFAULT_SEAT_LAYOUT, 'a', 5).gaps).toEqual({ a: 3 });
		expect(withGap(withGap(DEFAULT_SEAT_LAYOUT, 'a', 2), 'a', 0).gaps).toEqual({});
	});

	it('sizes tokens between 44px and 96px, smaller with more seats', () => {
		const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
		expect(seatTokenSize(ids(30), DEFAULT_SEAT_LAYOUT, { width: 320, height: 400 })).toBe(44);
		expect(seatTokenSize(ids(5), DEFAULT_SEAT_LAYOUT, { width: 1200, height: 900 })).toBe(96);
		expect(seatTokenSize(ids(8), DEFAULT_SEAT_LAYOUT, { width: 0, height: 0 })).toBe(56);
	});

	it('follows the token size setting, but never past the spacing or below 44px', () => {
		const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
		const roomy = { width: 1200, height: 900 };
		const base = seatTokenSize(ids(8), DEFAULT_SEAT_LAYOUT, roomy);
		expect(seatTokenSize(ids(8), DEFAULT_SEAT_LAYOUT, roomy, 1.25)).toBe(Math.round(base * 1.25));
		expect(seatTokenSize(ids(8), DEFAULT_SEAT_LAYOUT, roomy, 0.75)).toBe(Math.round(base * 0.75));
		// Crowded: already at the spacing limit, so a bigger setting changes nothing.
		const crowded = { width: 320, height: 400 };
		expect(seatTokenSize(ids(20), DEFAULT_SEAT_LAYOUT, crowded, 1.5)).toBe(
			seatTokenSize(ids(20), DEFAULT_SEAT_LAYOUT, crowded)
		);
		expect(seatTokenSize(ids(30), DEFAULT_SEAT_LAYOUT, crowded, 0.75)).toBe(44);
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

describe('keepInside', () => {
	it('pulls points in so a token of the given half-width stays on the board', () => {
		const board = { width: 200, height: 400 };
		const [left, middle] = keepInside(
			[
				{ x: 2, y: 99 },
				{ x: 50, y: 50 }
			],
			board,
			20
		);
		expect(left).toEqual({ x: 10, y: 95 });
		expect(middle).toEqual({ x: 50, y: 50 });
	});
	it('centres when the board is smaller than the token', () => {
		expect(keepInside([{ x: 0, y: 0 }], { width: 10, height: 10 }, 20)).toEqual([{ x: 50, y: 50 }]);
	});
});

describe('rotating with a custom layout', () => {
	const seats = ['a', 'b', 'c', 'd'];
	it('knows a rotation from a reorder', () => {
		expect(isRotation(seats, ['d', 'a', 'b', 'c'])).toBe(true);
		expect(isRotation(seats, ['b', 'c', 'd', 'a'])).toBe(true);
		expect(isRotation(seats, seats)).toBe(false);
		expect(isRotation(seats, ['b', 'a', 'c', 'd'])).toBe(false);
	});

	it('keeps hand-placed spots and gaps in place while the players move', () => {
		let layout = withPlaced(DEFAULT_SEAT_LAYOUT, 'a', { x: 20, y: 30 });
		layout = withGap(layout, 'c', 2);
		const after = ['d', 'a', 'b', 'c'];
		const turned = followSeating(layout, seats, after);
		// Place 1 was hand-placed (held by "a"); now "d" sits there.
		expect(turned.placed).toEqual({ d: { x: 20, y: 30 } });
		expect(turned.gaps).toEqual({ b: 2 });
		const board = { width: 400, height: 400 };
		expect(seatPoints(after, turned, board)).toEqual(seatPoints(seats, layout, board));
	});

	it('spreads everyone evenly, keeping the shape', () => {
		const layout = withShape(
			withPlaced(withGap(DEFAULT_SEAT_LAYOUT, 'a', 1), 'b', { x: 10, y: 10 }),
			'circle'
		);
		expect(spreadEvenly(layout)).toEqual({ shape: 'circle', gaps: {}, placed: {} });
	});
});

describe('orderAround', () => {
	const centre = { x: 100, y: 100 };
	// Top, right, bottom, left: clockwise on screen.
	const ring = [
		{ x: 100, y: 0 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
		{ x: 0, y: 100 }
	];

	it('keeps the order when everyone is where the order puts them', () => {
		expect(orderAround(['a', 'b', 'c', 'd'], ring, centre)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('follows seats dragged past each other', () => {
		// b and d swapped places on the table.
		const moved = [ring[0], ring[3], ring[2], ring[1]];
		expect(orderAround(['a', 'b', 'c', 'd'], moved, centre)).toEqual(['a', 'd', 'c', 'b']);
	});

	it('starts where seats move least, not from whoever is first', () => {
		// a was dragged from the top to between c and d: b and c keep their places.
		const moved = [{ x: 30, y: 170 }, ring[1], ring[2], ring[3]];
		expect(orderAround(['a', 'b', 'c', 'd'], moved, centre, ring)).toEqual(['d', 'b', 'c', 'a']);
	});
});

describe('the Storyteller board shape (Trevor, 2026-10-27)', () => {
	const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const phone = { width: 390, height: 640 };
	const laptop = { width: 1280, height: 620 };
	/** Each seat's clock position, in degrees from the top, clockwise, on its own board. */
	const clock = (points: { x: number; y: number }[]) =>
		points.map((p) => {
			const deg = (Math.atan2(p.x - 50, 50 - p.y) * 180) / Math.PI;
			return Math.round((deg + 360) % 360);
		});

	it('puts seats at different clock positions on a phone and a laptop by default', () => {
		const onPhone = clock(seatPoints(eight, DEFAULT_SEAT_LAYOUT, phone));
		const onLaptop = clock(seatPoints(eight, DEFAULT_SEAT_LAYOUT, laptop));
		expect(onPhone).not.toEqual(onLaptop);
	});

	it("keeps the Storyteller's clock positions on any screen, while filling it", () => {
		const shape = boardAspect(laptop)!;
		const theirs = clock(seatPoints(eight, DEFAULT_SEAT_LAYOUT, laptop));
		const onPhone = seatPoints(eight, DEFAULT_SEAT_LAYOUT, phone, shape);
		expect(clock(onPhone)).toEqual(theirs);
		// The ring still reaches 41% out on the phone's own board, top and side.
		expect(onPhone[0]).toEqual({ x: 50, y: 9 });
	});

	it('spaces a circle at equal angles whatever the shape', () => {
		const circle = withShape(DEFAULT_SEAT_LAYOUT, 'circle');
		const own = seatPoints(eight, circle, phone);
		const spaced = seatPoints(eight, circle, phone, boardAspect(laptop));
		spaced.forEach((p, i) => {
			expect(p.x).toBeCloseTo(own[i].x);
			expect(p.y).toBeCloseTo(own[i].y);
		});
	});

	it('rounds a board shape and reads only sensible ones back', () => {
		expect(boardAspect({ width: 1280, height: 620 })).toBe(2.06);
		expect(boardAspect({ width: 0, height: 620 })).toBeUndefined();
		expect(parseAspect(0.61)).toBe(0.61);
		expect(parseAspect('1.5')).toBeUndefined();
		expect(parseAspect(Infinity)).toBeUndefined();
		expect(parseAspect(50)).toBeUndefined();
	});

	it('fits the largest box of a shape on a board, with bands', () => {
		expect(fitAspect(phone, 2)).toEqual({ width: 390, height: 195 });
		expect(fitAspect(laptop, 1)).toEqual({ width: 620, height: 620 });
		expect(fitAspect({ width: 0, height: 0 }, 2)).toEqual({ width: 0, height: 0 });
	});

	it('moves points in a centred box to the whole board', () => {
		const box = fitAspect(phone, 2);
		const [top, middle] = centredIn(
			[
				{ x: 50, y: 0 },
				{ x: 50, y: 50 }
			],
			box,
			phone
		);
		// The 195px box sits 222.5px down the 640px phone.
		expect(top.y).toBeCloseTo((222.5 / 640) * 100);
		expect(middle).toEqual({ x: 50, y: 50 });
	});
});
