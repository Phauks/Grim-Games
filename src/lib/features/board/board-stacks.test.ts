import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { reminderStacks } from './board-stacks.ts';

/**
 * Stacks on a seat (Trevor, 2026-11-19: "Courtier drunk tokens aren't stacking on grim?
 * Shouldn't they do that and others?", look A, the top token with a ×N count).
 */
describe('reminderStacks', () => {
	const labels = (stacks: { label: string }[][]) => stacks.map((s) => s.map((r) => r.label));

	it("stacks a run's tokens on one seat, the latest on top", () => {
		// Wiki (https://wiki.bloodontheclocktower.com/Courtier#How_to_Run): "Tonight, mark them with
		// the Courtier’s DRUNK 1 reminder. The next night, replace the DRUNK 1 reminder with the
		// DRUNK 2 reminder."
		const s = scenario(['courtier', 'tealady', 'chef', 'imp', 'poisoner'])
			.reminder('tealady', 'courtier', 'Drunk 2')
			.reminder('tealady', 'poisoner', 'Poisoned')
			.reminder('tealady', 'courtier', 'Drunk 1');
		const seat = s.game.seats[s.seat('tealady')].reminders;
		const stacks = reminderStacks(seat, (id) => s.characters.get(id), false);
		expect(labels(stacks)).toEqual([['Drunk 1', 'Drunk 2'], ['Poisoned']]);
	});

	it('stacks the same reminder twice only with "Stack duplicate reminders" on', () => {
		const s = scenario(['mathematician', 'chef', 'empath', 'imp', 'poisoner'])
			.reminder('chef', 'mathematician', 'Abnormal')
			.reminder('chef', 'mathematician', 'Abnormal');
		const seat = s.game.seats[s.seat('chef')].reminders;
		const of = (id: string) => s.characters.get(id);
		expect(labels(reminderStacks(seat, of, false))).toEqual([['Abnormal'], ['Abnormal']]);
		expect(labels(reminderStacks(seat, of, true))).toEqual([['Abnormal', 'Abnormal']]);
	});

	it('never stacks generic tokens, each its own look', () => {
		const s = scenario(['chef', 'empath', 'imp', 'poisoner', 'monk'])
			.reminder('chef', 'generic', '')
			.reminder('chef', 'generic', '');
		const seat = s.game.seats[s.seat('chef')].reminders;
		expect(reminderStacks(seat, (id) => s.characters.get(id), true)).toHaveLength(2);
	});
});
