/**
 * Jinxes on a script. https://wiki.bloodontheclocktower.com/Djinn
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import { activeJinxes, isExclusiveJinx, jinxSetupWarnings, scriptJinxes } from './jinxes.ts';

const data = committedGameData();
const name = (id: string) => data.byId.get(id)?.name ?? id;

describe('scriptJinxes', () => {
	it('finds no jinxes on the base editions', () => {
		for (const edition of ['tb', 'bmr', 'snv']) {
			const ids = editionScript(edition, data)!.characters.map((c) => c.id);
			expect(scriptJinxes(data.jinxes, ids), edition).toEqual([]);
		}
	});

	// https://wiki.bloodontheclocktower.com/Spy#Related_Jinxes
	it('lists every jinx between characters on the script, in either order', () => {
		const jinxes = scriptJinxes(data.jinxes, ['spy', 'magician', 'chef', 'heretic', 'baron']);
		expect(jinxes.map((j) => [...j.characters].sort().join('+'))).toEqual(
			expect.arrayContaining(['magician+spy', 'heretic+spy', 'baron+heretic'])
		);
		expect(jinxes.every((j) => j.source === 'official')).toBe(true);
	});

	it('lets a homebrew jinx replace the official one for the same pair', () => {
		const jinxes = scriptJinxes(
			data.jinxes,
			['spy', 'magician', 'custom'],
			[
				{ characters: ['magician', 'spy'], reason: 'House rule.' },
				{ characters: ['custom', 'spy'], reason: 'Homebrew.' },
				{ characters: ['custom', 'imp'], reason: 'Imp is not on the script.' }
			]
		);
		expect(jinxes.map((j) => [j.source, j.reason])).toEqual([
			['script', 'House rule.'],
			['script', 'Homebrew.']
		]);
	});
});

describe('exclusive jinxes', () => {
	// https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes
	it('recognises "only 1 jinxed character can be in play"', () => {
		const exclusive = data.jinxes.all.filter((j) => isExclusiveJinx(j.reason));
		expect(exclusive.map((j) => [...j.characters].sort().join('+')).sort()).toEqual([
			'baron+heretic',
			'godfather+heretic',
			'heretic+lleech',
			'heretic+pithag',
			'heretic+spy',
			'heretic+widow'
		]);
	});

	it('warns only when both are in play', () => {
		const jinxes = scriptJinxes(data.jinxes, ['heretic', 'baron', 'spy', 'magician']);
		expect(jinxSetupWarnings(jinxes, ['heretic', 'chef'], name)).toEqual([]);
		const warnings = jinxSetupWarnings(jinxes, ['heretic', 'baron', 'magician', 'spy'], name);
		expect(warnings.map((w) => w.message).sort()).toEqual([
			'Heretic and Baron are jinxed: only one of them can be in play.',
			'Heretic and Spy are jinxed: only one of them can be in play.'
		]);
		expect(activeJinxes(jinxes, ['spy', 'magician']).map((j) => j.characters)).toEqual([
			['magician', 'spy']
		]);
	});
});
