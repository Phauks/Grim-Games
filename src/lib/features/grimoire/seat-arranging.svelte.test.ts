import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import { DEFAULT_SEAT_LAYOUT, type SeatLayout } from '#lib/ui/seating/seat-layout.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { SeatArranging } from './seat-arranging.svelte.ts';

const seating = ['a', 'b', 'c'] as SeatId[];
const points = [
	{ x: 20, y: 50 },
	{ x: 50, y: 20 },
	{ x: 80, y: 50 }
];

/** A board 200px square, its element at the page's top left. */
function setup({ arranging = true } = {}) {
	const runs: unknown[] = [];
	const layouts: SeatLayout[] = [];
	const grimoire = {
		layout: DEFAULT_SEAT_LAYOUT,
		run: (command: unknown) => (runs.push(command), true),
		setLayout: (layout: SeatLayout) => layouts.push(layout)
	} as unknown as Grimoire;
	const element = {
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 })
	} as HTMLElement;
	const arrange = new SeatArranging(() => ({
		grimoire,
		seating,
		layout: DEFAULT_SEAT_LAYOUT,
		points,
		size: 40,
		board: { width: 200, height: 200 },
		element
	}));
	arrange.arranging = arranging;
	return { arrange, runs, layouts };
}

function pointer(x: number, y: number): PointerEvent {
	return {
		pointerId: 1,
		clientX: x,
		clientY: y,
		currentTarget: { setPointerCapture: () => {} }
	} as unknown as PointerEvent;
}

describe('SeatArranging', () => {
	it('outside Arrange seats, drags a seat only once it is held (Trevor, 2026-10-25)', () => {
		const { arrange, layouts } = setup({ arranging: false });
		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.dragMove(pointer(60, 120));
		expect(arrange.drag).toBeUndefined();
		arrange.dragEnd(pointer(60, 120));
		expect(layouts).toEqual([]);

		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.held(seating[0]);
		arrange.dragMove(pointer(60, 120));
		arrange.dragEnd(pointer(60, 120));
		expect(layouts).toHaveLength(1);
		// A hold on another seat than the one pressed moves nothing.
		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.held(seating[1]);
		expect(arrange.drag).toBeUndefined();
	});

	it('draws a dragged seat under the finger, keeping where it was grabbed', () => {
		const { arrange } = setup();
		// Grabbed 2px right of seat a's centre (40, 100).
		arrange.dragStart(pointer(42, 100), seating[0], points[0]);
		arrange.dragMove(pointer(62, 120));
		expect(arrange.shown[0]).toEqual({ x: 30, y: 60 });
		expect(arrange.shown[1]).toBe(points[1]);
	});

	it('places a seat where it is let go', () => {
		const { arrange, layouts, runs } = setup();
		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.dragMove(pointer(60, 140));
		arrange.dragEnd(pointer(60, 140));
		expect(runs).toEqual([]);
		expect(layouts.at(-1)?.placed).toEqual({ a: { x: 30, y: 70 } });
		expect(arrange.drag).toBeUndefined();
	});

	it('swaps two players when one is dropped on the other (https://wiki.bloodontheclocktower.com/Matron)', () => {
		const { arrange, runs } = setup();
		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.dragMove(pointer(158, 100));
		expect(arrange.reorderTarget).toBe('c');
		arrange.dragEnd(pointer(158, 100));
		expect(runs).toEqual([{ type: 'SwapSeats', seatA: 'a', seatB: 'c' }]);
	});

	it('ignores a press that does not move past the slop', () => {
		const { arrange, layouts } = setup();
		arrange.dragStart(pointer(40, 100), seating[0], points[0]);
		arrange.dragMove(pointer(42, 101));
		arrange.dragEnd(pointer(42, 101));
		expect(layouts).toEqual([]);
	});

	it('brings the last touched seat to the front, even when not arranging', () => {
		const { arrange } = setup();
		arrange.arranging = false;
		arrange.dragStart(pointer(100, 40), seating[1], points[1]);
		expect(arrange.front).toBe('b');
		expect(arrange.drag).toBeUndefined();
	});

	it('nudges a seat with the arrow keys', () => {
		const { arrange, layouts } = setup();
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
		arrange.nudge(event, seating[2], points[2]);
		expect(layouts.at(-1)?.placed).toEqual({ c: { x: 82, y: 50 } });
	});
});
