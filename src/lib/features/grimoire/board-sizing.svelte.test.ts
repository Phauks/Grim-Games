import { describe, expect, it } from 'vitest';
import { createGame, type EngineContext } from '#lib/core/engine/index.ts';
import type { Game, SeatId } from '#lib/core/model/index.ts';
import { DEFAULT_SEAT_LAYOUT, type SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import { BoardSizing } from './board-sizing.svelte.ts';

/** Runs in the browser project, which can't read the data files: no characters loaded. */
const ctx: EngineContext = {
	characters: new Map(),
	newId: (() => {
		let n = 0;
		return () => `id${++n}`;
	})(),
	now: () => 0,
	random: () => 0
};

/** A five-player game with two reminders on the first seat. */
function game(): Game {
	const made = createGame(
		{ type: 'CreateGame', script: { meta: { name: 'Sizing' }, entries: [] }, playerCount: 5 },
		ctx
	);
	if (!made.ok) throw new Error(made.error.message);
	const g = made.session.game;
	const first = g.seating[0];
	const reminders = ['r1', 'r2'].map((reminderId) => ({
		reminderId,
		characterId: 'poisoner',
		label: 'Poisoned'
	}));
	return { ...g, seats: { ...g.seats, [first]: { ...g.seats[first], reminders } } };
}

/** Sizing for a 600px square board; `shown` follows the ring's points, as the board's do. */
function setup() {
	const g = game();
	const context = $state<{ drag?: { seatId: SeatId; at: SeatPoint }; walking: boolean }>({
		walking: false
	});
	const sizing: BoardSizing = new BoardSizing(() => ({
		game: g,
		characters: new Map(),
		layout: DEFAULT_SEAT_LAYOUT,
		spacedFor: undefined,
		walking: context.walking,
		offScriptOk: new Set(),
		nominations: false,
		shown: () => sizing.points,
		drag: context.drag,
		rootFont: 16
	}));
	sizing.width = 600;
	sizing.height = 600;
	return { g, sizing, context };
}

describe('BoardSizing', () => {
	it('puts every seat on the board, and gives each reminder a place', () => {
		const { g, sizing } = setup();
		expect(sizing.size).toBeGreaterThan(0);
		expect(sizing.points).toHaveLength(g.seating.length);
		for (const p of sizing.points) {
			expect(p.x).toBeGreaterThan(0);
			expect(p.x).toBeLessThan(100);
			expect(p.y).toBeGreaterThan(0);
			expect(p.y).toBeLessThan(100);
		}
		expect(sizing.fan[0]).toHaveLength(2);
		expect(sizing.fan[1]).toHaveLength(0);
	});

	it("keeps token size when the night's strip takes part of the board (Trevor, 2026-10-23)", () => {
		const { sizing, context } = setup();
		sizing.stripReserve = 120;
		const before = sizing.size;
		context.walking = true;
		sizing.height = 480;
		expect(sizing.size).toBe(before);
	});

	it("moves a dragged seat's reminders with it and leaves the rest (Trevor, 2026-10-26)", () => {
		const { g, sizing, context } = setup();
		const rest = sizing.fan.map((spots) => spots.map((p) => ({ ...p })));
		const at = sizing.points[0];
		context.drag = { seatId: g.seating[0], at };
		expect(sizing.fan).toEqual(rest);
		context.drag = { seatId: g.seating[0], at: { x: at.x + 5, y: at.y - 3 } };
		expect(sizing.fan[0]).toEqual(rest[0].map((p) => ({ x: p.x + 5, y: p.y - 3 })));
		expect(sizing.fan.slice(1)).toEqual(rest.slice(1));
	});
});
