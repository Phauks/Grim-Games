import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { analyseSelection, planBag } from '#lib/core/rules/index.ts';
import { buildErrors } from './build-check.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);

function check(players: number, ids: string[], standIns: Record<string, string> = {}) {
	const selection: Record<string, number> = {};
	for (const id of ids) selection[id] = (selection[id] ?? 0) + 1;
	const scriptOrder = [...new Set(ids)];
	const analysis = analyseSelection({ players, selection, scriptOrder, lookup });
	const plan = planBag({
		selection,
		scriptCharacters: scriptOrder.map((id) => lookup(id)!),
		lookup,
		standIns,
		random: () => 0
	});
	const travellers = ids.filter((id) => lookup(id)?.type === 'traveller').length;
	return buildErrors({ analysis, issues: plan.issues, travellers });
}

describe('buildErrors', () => {
	it('is empty for a clean selection', () => {
		expect(check(5, ['washerwoman', 'empath', 'monk', 'poisoner', 'imp'])).toEqual([]);
	});

	it('flags a missing Demon and the wrong bag size', () => {
		const errors = check(5, ['washerwoman', 'empath', 'monk', 'poisoner']);
		expect(errors.some((e) => /Demon/.test(e))).toBe(true);
		expect(errors.some((e) => /4 characters chosen for 5 players/.test(e))).toBe(true);
	});

	it('flags copies the rules do not allow', () => {
		const errors = check(5, ['washerwoman', 'washerwoman', 'monk', 'poisoner', 'imp']);
		expect(errors.some((e) => /Washerwoman is chosen 2 times/.test(e))).toBe(true);
	});

	it('flags counts that ignore a setup change (Baron: +2 Outsiders)', () => {
		expect(
			check(7, ['washerwoman', 'empath', 'monk', 'chef', 'librarian', 'baron', 'imp'])
		).not.toEqual([]);
	});

	it('flags missing Travellers beyond 15 players', () => {
		const ids = [
			...['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller'],
			...['undertaker', 'monk', 'ravenkeeper'],
			...['butler', 'saint'],
			...['poisoner', 'spy', 'scarletwoman', 'imp']
		];
		expect(check(16, ids).some((e) => /0 Travellers chosen; expected 1/.test(e))).toBe(true);
		expect(check(16, [...ids, 'thief'])).toEqual([]);
	});
});
