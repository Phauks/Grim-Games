/**
 * A character in play more than once wakes once per player (Trevor, 2026-11-12), as the wiki
 * runs the Village Idiot (https://wiki.bloodontheclocktower.com/Village_Idiot, How to Run);
 * Legion's players share one step (https://wiki.bloodontheclocktower.com/Legion, How to Run).
 */
import { describe, expect, it } from 'vitest';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { committedCharacters, committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { withNightInfo } from '#lib/core/rules/night/info/steps.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import { stepHolders } from '#lib/core/rules/night/board-steps.ts';
import { type Night } from '#lib/core/model/overrides.ts';
import { sheetStepId, withCopySteps } from './copy-steps.ts';

const data = committedGameData();

function steps(s: Scenario, night: Night = 'other') {
	const inPlay = s.game.seating.map((seat) => data.byId.get(s.game.seats[seat].characterId!)!);
	const order = nightOrder({ night, sheet: data.nightSheet, inPlay, players: inPlay.length });
	return withNightInfo(withCopySteps(order.steps, s.game, s.characters), s.game, s.characters);
}

describe('withCopySteps', () => {
	it('wakes each Village Idiot on their own step, one after the other', () => {
		// Wiki: "During each night, wake any Village Idiot. They point to a player. Give a thumbs up or a thumbs down. Put that Village Idiot to sleep. Repeat until all Village Idiots have acted."
		const s = scenario(['villageidiot', 'villageidiot', 'villageidiot', 'imp', 'chef']);
		const [a, b, c] = s.game.seating;
		const idiots = steps(s).filter((step) => step.character?.id === 'villageidiot');
		expect(idiots.map((step) => step.id)).toEqual([
			`villageidiot:copy:${a}`,
			`villageidiot:copy:${b}`,
			`villageidiot:copy:${c}`
		]);
		expect(idiots.map((step) => stepHolders(s.game, step, s.characters))).toEqual([[a], [b], [c]]);
		// Each copy keeps the sheet's place, for the night's order.
		expect(idiots.map(sheetStepId)).toEqual(['villageidiot', 'villageidiot', 'villageidiot']);
		const all = steps(s).map((step) => step.id);
		expect(all.indexOf(`villageidiot:copy:${b}`)).toBe(all.indexOf(`villageidiot:copy:${a}`) + 1);
	});

	it('works out each copy’s answers for that player alone', () => {
		const s = scenario(['empath', 'empath', 'imp', 'chef', 'poisoner']);
		const empaths = steps(s).filter((step) => step.character?.id === 'empath');
		expect(empaths).toHaveLength(2);
		for (const [i, step] of empaths.entries()) {
			const info = step.info;
			const asked =
				info?.kind === 'picker'
					? info.pickers.map((p) => p.seatId)
					: info?.kind === 'answer'
						? info.answers.map((a) => a.seatId)
						: [];
			expect(asked).toEqual([s.game.seating[i]]);
		}
	});

	it('keeps one step for a character played once', () => {
		const s = scenario(['empath', 'imp', 'chef', 'poisoner', 'monk']);
		expect(steps(s).filter((step) => step.character?.id === 'empath')).toEqual([
			expect.objectContaining({ id: 'empath' })
		]);
	});

	it('keeps one step for Legion, which the Storyteller runs for all its players', () => {
		// Wiki: "Each night except the first, you may decide that a player dies."
		expect(rulesOf('legion', committedCharacters())?.oneNightStep).toBe(true);
		const s = scenario(['legion', 'legion', 'legion', 'chef', 'empath']);
		expect(
			steps(s)
				.filter((step) => step.character?.id === 'legion')
				.map((x) => x.id)
		).toEqual(['legion']);
	});
});
