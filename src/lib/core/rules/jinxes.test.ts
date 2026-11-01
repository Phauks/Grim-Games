/**
 * Jinxes on a script. https://wiki.bloodontheclocktower.com/Djinn
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	activeJinxes,
	barredAbilities,
	isExclusiveJinx,
	jinxIsExclusive,
	jinxesOnStep,
	jinxRulesBetween,
	jinxSetupWarnings,
	scriptJinxes
} from './jinxes.ts';

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

describe('jinx rules data', () => {
	const official = new Set(data.jinxes.all.map((j) => [...j.characters].sort().join('+')));

	it('names only pairs TPI jinxes', () => {
		for (const character of data.characters) {
			for (const partner of Object.keys(rulesOf(character.id)?.jinxes ?? {})) {
				const pair = [character.id, partner].sort().join('+');
				expect(official.has(pair), `${character.id}.jinxes.${partner}`).toBe(true);
			}
		}
	});

	// https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes
	it('marks exactly the jinxes whose wording says only one can be in play', () => {
		for (const jinx of data.jinxes.all) {
			expect(jinxIsExclusive(jinx), jinx.characters.join('+')).toBe(isExclusiveJinx(jinx.reason));
		}
	});

	it('reads either side of the pair, and nothing for a jinx that is text only', () => {
		expect(jinxRulesBetween('boffin', 'drunk')).toEqual({ notGiven: true });
		expect(jinxRulesBetween('drunk', 'boffin')).toEqual({ notGiven: true });
		expect(jinxRulesBetween('spy', 'magician')).toBeUndefined();
	});

	it("reads a custom character's own jinx rules", () => {
		const custom = new Map([
			['giver', { rules: { jinxes: { chef: { notGiven: true as const } } } }]
		]);
		expect(barredAbilities('giver', ['giver', 'chef', 'empath'], custom)).toEqual(['chef']);
	});
});

describe('jinxesOnStep', () => {
	const jinxes = scriptJinxes(data.jinxes, ['spy', 'magician', 'poppygrower', 'chef']);
	const pairs = (list: readonly { characters: readonly string[] }[]) =>
		list.map((j) => [...j.characters].sort().join('+'));

	// https://wiki.bloodontheclocktower.com/Djinn: a jinx is in effect while both are in play.
	it('shows each jinx on both characters once both are in play', () => {
		const inPlay = ['spy', 'poppygrower', 'chef'];
		expect(pairs(jinxesOnStep(jinxes, 'spy', inPlay))).toEqual(['poppygrower+spy']);
		expect(pairs(jinxesOnStep(jinxes, 'poppygrower', inPlay))).toEqual(['poppygrower+spy']);
		expect(jinxesOnStep(jinxes, 'chef', inPlay)).toEqual([]);
	});

	it('shows every jinx a character has with characters in play, in the given order', () => {
		const inPlay = ['spy', 'magician', 'poppygrower'];
		expect(pairs(jinxesOnStep(jinxes, 'spy', inPlay))).toEqual(
			pairs(jinxes.filter((j) => j.characters.includes('spy')))
		);
		expect(pairs(jinxesOnStep(jinxes, 'magician', inPlay))).toEqual(['magician+spy']);
	});

	it('shows nothing while only one of the pair is in play, or the character is not', () => {
		expect(jinxesOnStep(jinxes, 'spy', ['spy', 'chef'])).toEqual([]);
		expect(jinxesOnStep(jinxes, 'spy', ['magician', 'poppygrower'])).toEqual([]);
	});

	it("keeps a script's own wording as it is", () => {
		const own = scriptJinxes(
			data.jinxes,
			['spy', 'custom'],
			[{ characters: ['custom', 'spy'], reason: 'Homebrew wording.' }]
		);
		expect(jinxesOnStep(own, 'custom', ['spy', 'custom']).map((j) => j.reason)).toEqual([
			'Homebrew wording.'
		]);
	});
});
