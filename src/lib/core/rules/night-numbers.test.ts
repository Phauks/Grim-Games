/**
 * Night order numbers on token badges count characters only. Rules source:
 * https://wiki.bloodontheclocktower.com/Glossary (Dusk, Dawn, Minion Info and Demon Info are
 * steps of the night, not characters).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { nightOrder } from './night-order.ts';
import { diedSinceNewDay, sheetNightNumbers, stepNightNumbers } from './night-numbers.ts';

const data = committedGameData();
const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);

describe('night numbers', () => {
	it('numbers only the characters that wake, in the game’s order', () => {
		const { steps } = nightOrder({
			night: 'first',
			sheet: data.nightSheet,
			players: 8,
			inPlay: get('imp', 'poisoner', 'washerwoman', 'empath', 'chef', 'saint')
		});
		const numbers = stepNightNumbers(steps);
		const waking = steps.filter((s) => s.kind === 'character').map((s) => s.id);
		// Dusk and the evil team's info come first, but the first character is still 1.
		expect(steps[0].id).toBe('dusk');
		expect([...numbers.keys()]).toEqual(waking);
		expect([...numbers.values()]).toEqual(waking.map((_, i) => i + 1));
		expect(numbers.has('saint')).toBe(false);
		expect(numbers.has('dawn')).toBe(false);
	});

	it('skips steps after Dawn and keeps a character’s first number', () => {
		const character = data.byId.get('empath')!;
		const numbers = stepNightNumbers([
			{ kind: 'marker', afterDawn: false },
			{ kind: 'character', character, afterDawn: false },
			{ kind: 'custom', afterDawn: false },
			{ kind: 'character', character, afterDawn: false },
			{ kind: 'character', character: data.byId.get('leviathan')!, afterDawn: true }
		]);
		expect([...numbers]).toEqual([['empath', 1]]);
	});

	it('numbers TPI’s whole sheet without the night markers', () => {
		const numbers = sheetNightNumbers(data.nightSheet.firstNight);
		const characters = data.nightSheet.firstNight.filter(
			(id) => !['dusk', 'dawn', 'minioninfo', 'demoninfo'].includes(id)
		);
		expect(numbers.size).toBe(characters.length);
		expect(numbers.get(characters[0])).toBe(1);
		expect(numbers.has('dusk')).toBe(false);
	});

	it('renumbers the rest when a step is left out (a dead player)', () => {
		const { steps } = nightOrder({
			night: 'other',
			sheet: data.nightSheet,
			players: 8,
			inPlay: get('imp', 'poisoner', 'monk', 'empath')
		});
		const all = stepNightNumbers(steps);
		const alive = stepNightNumbers(steps, (s) => s.character?.id !== 'monk');
		expect(alive.has('monk')).toBe(false);
		expect([...alive.values()]).toEqual([1, 2, 3]);
		expect(all.size).toBe(4);
	});

	// https://wiki.bloodontheclocktower.com/Ravenkeeper: woken on the night they die.
	it('knows who died since the last New day', () => {
		const died = diedSinceNewDay([
			{ type: 'DeathSet', seatId: 'a', dead: true },
			{ type: 'DayStarted' },
			{ type: 'DeathSet', seatId: 'b', dead: true },
			{ type: 'DeathSet', seatId: 'c', dead: true },
			{ type: 'DeathSet', seatId: 'c', dead: false }
		]);
		expect([...died]).toEqual(['b']);
	});
});
