import { describe, expect, it } from 'vitest';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import type { Character } from '#lib/core/data/index.ts';
import type { Game } from '#lib/core/model/index.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { onBoard } from './reminders.ts';
import { ReminderDragging } from './reminder-drag.svelte.ts';

/** Runs in the browser project, which can't read the data files: one hand-made character. */
const poisoner = {
	id: 'poisoner',
	name: 'Poisoner',
	type: 'minion',
	ability: '',
	setup: false,
	reminders: ['Poisoned'],
	remindersGlobal: [],
	special: []
} as unknown as Character;
let n = 0;
const ctx: EngineContext = {
	characters: new Map([['poisoner', poisoner]]),
	newId: () => `id${++n}`,
	now: () => 0,
	random: () => 0
};
const characters = ctx.characters;

/** Five seats, with a Poisoned reminder on the second. */
function game(): Game {
	let made = createGame(
		{ type: 'CreateGame', script: { meta: { name: 'Drag' }, entries: [] }, playerCount: 5 },
		ctx
	);
	if (!made.ok) throw new Error(made.error.message);
	made = dispatch(
		made.session,
		{
			type: 'AddReminder',
			seatId: made.session.game.seating[1],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		},
		ctx
	);
	if (!made.ok) throw new Error(made.error.message);
	return made.session.game;
}

/** A board 500px square at the page's top left, seats on a row at y = 50%. */
function setup(free = false) {
	const g = game();
	const calls: unknown[][] = [];
	const confirm = {
		request: (...args: unknown[]) => calls.push(['request', ...args]),
		requestReturn: (...args: unknown[]) => calls.push(['return', ...args]),
		requestRule: (...args: unknown[]) => calls.push(['rule', ...args]),
		requestLoose: (...args: unknown[]) => calls.push(['loose', ...args])
	};
	const element = document.createElement('div');
	element.getBoundingClientRect = () => new DOMRect(0, 0, 500, 500);
	const points = g.seating.map((_, i) => ({ x: 10 + i * 20, y: 50 }));
	const dragging = new ReminderDragging(() => ({
		grimoire: {
			setReminderSpot: () => {},
			run: (command: unknown) => calls.push(['run', command])
		} as unknown as Grimoire,
		game: g,
		characters,
		points,
		size: 40,
		board: { width: 500, height: 500 },
		element,
		free,
		confirm: confirm as never
	}));
	const reminder = onBoard(g)[0];
	return { g, dragging, calls, reminder };
}

describe('ReminderDragging', () => {
	it('finds the seat within reach of a point', () => {
		const { g, dragging } = setup();
		expect(dragging.seatAt({ x: 31, y: 51 })).toBe(g.seating[1]);
		expect(dragging.seatAt({ x: 20, y: 80 })).toBeUndefined();
	});

	it('takes a tap only on the character token itself, a drag near it', () => {
		const { g, dragging } = setup();
		// Seat 2's token is 40px across, centred 150px in: 25px off is beside it.
		expect(dragging.seatAt({ x: 35, y: 50 })).toBe(g.seating[1]);
		expect(dragging.seatAt({ x: 35, y: 50 }, true)).toBeUndefined();
		expect(dragging.seatAt({ x: 33, y: 50 }, true)).toBe(g.seating[1]);
	});

	it('follows the finger, with the seat under it and where the reminder came from', () => {
		const { g, dragging, reminder } = setup();
		dragging.move(reminder.reminderId, g.seating[1], 250, 250, false);
		expect(dragging.drag).toEqual({
			reminderId: reminder.reminderId,
			from: g.seating[1],
			at: { x: 50, y: 50 },
			target: g.seating[2]
		});
		expect(dragging.origin?.reminder).toBe(reminder);
		expect(dragging.held).toBeUndefined();
	});

	it('asks to move a reminder dropped on another seat', () => {
		const { g, dragging, calls, reminder } = setup();
		dragging.move(reminder.reminderId, g.seating[1], 250, 250, true);
		expect(dragging.drag).toBeUndefined();
		expect(calls).toEqual([['request', reminder.reminderId, g.seating[2]]]);
	});

	it('leaves a reminder dropped back on its own seat', () => {
		const { g, dragging, calls, reminder } = setup();
		dragging.move(reminder.reminderId, g.seating[1], 150, 250, true);
		expect(calls).toEqual([]);
	});

	it('marks no target seat in loose mode', () => {
		const { g, dragging, reminder } = setup(true);
		dragging.move(reminder.reminderId, g.seating[1], 250, 250, false);
		expect(dragging.drag?.target).toBeUndefined();
	});

	it('stops on cancel', () => {
		const { g, dragging, reminder } = setup();
		dragging.move(reminder.reminderId, g.seating[1], 250, 250, false);
		dragging.cancel();
		expect(dragging.drag).toBeUndefined();
	});

	it('makes a new ∞ token like a reminder dropped on "+ New token", leaving it on its seat', () => {
		const { dragging, calls, reminder, g } = setup();
		const plus = document.createElement('button');
		plus.dataset.newToken = '';
		plus.style.cssText = 'position: fixed; left: 0; top: 0; width: 40px; height: 40px; z-index: 9';
		document.body.append(plus);
		try {
			dragging.move(reminder.reminderId, g.seating[1], 20, 20, false);
			expect(dragging.drag?.overNew).toBe(true);
			expect(dragging.drag?.target).toBeUndefined();
			dragging.move(reminder.reminderId, g.seating[1], 20, 20, true);
			const like = { characterId: 'poisoner', label: 'Poisoned' };
			expect(calls).toEqual([
				['run', { type: 'AddGenericToken', look: { note: 'Poisoned', like } }]
			]);
		} finally {
			plus.remove();
		}
	});
});
