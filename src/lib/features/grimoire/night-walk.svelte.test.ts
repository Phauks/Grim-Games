import { describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { createGame, type EngineContext } from '#lib/core/engine/index.ts';
import type { Game } from '#lib/core/model/index.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { NightWalk, type NightWalkContext } from './night-walk.svelte.ts';

/** Runs in the browser project, which can't read the data files: no night order loaded. */
const ctx: EngineContext = {
	characters: new Map(),
	newId: (() => {
		let n = 0;
		return () => `id${++n}`;
	})(),
	now: () => 0,
	random: () => 0
};

function game(withCharacter: boolean): Game {
	const made = createGame(
		{ type: 'CreateGame', script: { meta: { name: 'Walk' }, entries: [] }, playerCount: 5 },
		ctx
	);
	if (!made.ok) throw new Error(made.error.message);
	const g = made.session.game;
	if (!withCharacter) return g;
	const first = g.seating[0];
	return { ...g, seats: { ...g.seats, [first]: { ...g.seats[first], characterId: 'imp' } } };
}

/** A NightWalk on a board whose saved view is `saved`, with `over` in its context. */
function setup(over: Partial<NightWalkContext> = {}, saved = {}) {
	const views: unknown[] = [];
	const grimoire = {
		open: { viewOnly: false },
		nightRunning: false,
		nightView: saved,
		saveNightView: (view: unknown) => views.push(view)
	} as unknown as Grimoire;
	let walk!: NightWalk;
	const stop = $effect.root(() => {
		walk = new NightWalk(() => ({
			grimoire,
			game: game(true),
			characters: ctx.characters,
			data: undefined,
			today: { changes: new Map(), died: new Set() } as never,
			rules: [],
			wakes: () => true,
			ended: false,
			busy: false,
			...over
		}));
	});
	flushSync();
	return { walk, views, stop };
}

describe('NightWalk', () => {
	it('comes back where it was after a reload, and keeps saving where it is', () => {
		const { walk, views, stop } = setup({}, { walk: { night: 'other', index: 3 } });
		expect(walk.walk).toEqual({ night: 'other', index: 3 });
		expect(walk.nightOn).toBe(true);
		walk.walk = undefined;
		flushSync();
		expect(views.at(-1)).toEqual({ walk: undefined, guided: undefined });
		stop();
	});

	it('can run once a seat has a character, unless the game is over or the board busy', () => {
		const ok = setup();
		expect(ok.walk.canRun).toBe(true);
		ok.stop();
		for (const over of [{ ended: true }, { busy: true }, { game: game(false) }]) {
			const { walk, stop } = setup(over);
			expect(walk.canRun, JSON.stringify(Object.keys(over))).toBe(false);
			stop();
		}
	});

	it('has no steps and does not start before the night order loads', () => {
		const { walk, stop } = setup();
		walk.run();
		expect(walk.walk).toBeUndefined();
		expect(walk.steps).toEqual([]);
		expect(walk.holders).toEqual([]);
		stop();
	});
});
