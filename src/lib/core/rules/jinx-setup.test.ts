/**
 * `withPartnerAbility` jinxes at setup (`jinx-setup.ts`) and the setup changes that may apply
 * through them (`analyseSetup`'s `mayApply`). The official cases are tested with their jinx,
 * in `jinxes/alchemist__summoner.test.ts` and `jinxes/alchemist__marionette.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { readJinxRules } from '#lib/core/data/jinx-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { abilityJinxSetup } from './jinx-setup.ts';
import { analyseSetup } from './setup.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);
const of = (...ids: string[]) => ids.map((id) => lookup(id)!);

describe('withPartnerAbility in a jinxes block', () => {
	it('reads partner-setup and partner-in-play, and nothing else', () => {
		const issues = new Issues();
		const good = {
			a: { withPartnerAbility: 'partner-setup' },
			b: { withPartnerAbility: 'partner-in-play' }
		};
		expect(readJinxRules(good, 'jinxes', issues)).toEqual(good);
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules({ a: { withPartnerAbility: 'sometimes' } }, 'jinxes', bad);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.withPartnerAbility',
			'jinxes.a'
		]);
	});
});

describe('abilityJinxSetup', () => {
	// A homebrew character whose own jinx makes the Baron's setup change apply through it.
	const thief: Character = {
		...lookup('alchemist')!,
		id: 'thief',
		name: 'Thief',
		edition: undefined,
		rules: { jinxes: { baron: { withPartnerAbility: 'partner-setup' } } }
	};
	const find = (id: string) => (id === 'thief' ? thief : lookup(id));

	it("reads a homebrew character's own jinx, with the partner on the script", () => {
		const out = abilityJinxSetup(['thief'], ['thief', 'baron'], find);
		expect(out.mayApply).toEqual([
			{ character: lookup('baron'), as: 'Thief with the Baron ability' }
		]);
		expect(out.notes).toEqual([]);
		expect(abilityJinxSetup(['thief'], ['thief'], find).mayApply).toEqual([]);
		expect(abilityJinxSetup([], ['thief', 'baron'], find).mayApply).toEqual([]);
	});

	it('reads the jinx from the chosen character only', () => {
		expect(abilityJinxSetup(['summoner'], ['alchemist', 'summoner'], lookup)).toEqual({
			mayApply: [],
			notes: []
		});
	});
});

describe('analyseSetup with a setup change that may apply', () => {
	// 7 players: 5 Townsfolk, 0 Outsiders, 1 Minion, 1 Demon (https://wiki.bloodontheclocktower.com/Setup).
	const seven = of('chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp');

	it("allows a delta's counts as well as the usual ones", () => {
		const result = analyseSetup({
			players: 7,
			inPlay: seven,
			mayApply: [{ character: lookup('baron')!, as: 'Thief with the Baron ability' }]
		});
		expect(result.expected.outsider).toEqual([0, 2]);
		expect(result.warnings).toEqual([]);
		expect(result.reasons.outsider).toEqual(['Thief with the Baron ability: +2 Outsiders']);
	});

	it("allows a set count as well as the sheet's, and keeps a chosen one's", () => {
		const summoner = { character: lookup('summoner')!, as: 'Alchemist with the Summoner ability' };
		const result = analyseSetup({ players: 7, inPlay: seven, mayApply: [summoner] });
		expect(result.expected.demon).toEqual([0, 1]);
		expect(result.notes).toEqual([
			'Alchemist with the Summoner ability: Put a Townsfolk in the bag instead of the Demon.'
		]);
		const withSummoner = analyseSetup({
			players: 7,
			inPlay: of('chef', 'empath', 'monk', 'soldier', 'mayor', 'saint', 'summoner'),
			mayApply: [summoner]
		});
		expect(withSummoner.expected.demon).toEqual([0]);
	});
});
