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
	givenInstead,
	isExclusiveJinx,
	jinxedPartners,
	jinxIsExclusive,
	jinxRulesBetween,
	jinxSetupWarnings,
	jinxedWith,
	ownJinxes,
	ownJinxRules,
	registeredTo,
	scriptJinxes
} from './jinxes.ts';
import { readJinxRules } from '#lib/core/data/jinx-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Script } from '#lib/core/data/index.ts';

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
		expect(jinxRulesBetween('alchemist', 'boffin')).toBeUndefined();
	});

	it('reads the jinx rules that reuse other rules, and rejects bad ones', () => {
		const issues = new Issues();
		expect(
			readJinxRules(
				{
					a: { registersTo: { alignments: ['evil'], always: true } },
					b: { impairsPartner: 'poisoned', noKill: 'token' },
					c: { noGrimoire: true, grimoireHides: ['partner', 'demon'] }
				},
				'jinxes',
				issues
			)
		).toEqual({
			a: { registersTo: { alignments: ['evil'], always: true } },
			b: { impairsPartner: 'poisoned', noKill: 'token' },
			c: { noGrimoire: true, grimoireHides: ['partner', 'demon'] }
		});
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { registersTo: { always: true } },
				b: { impairsPartner: 'no-ability' },
				c: { noKill: 'sometimes' },
				d: { grimoireHides: ['minion', 'everyone'] }
			},
			'jinxes',
			bad
		);
		expect(bad.list).toHaveLength(8);
	});

	it('reads the Leviathan and Riot jinx rules, and rejects bad ones', () => {
		const issues = new Issues();
		const good = {
			a: { endsGame: { kind: 'nominated-marked-executed', winner: 'good', token: 'Safe' } },
			b: { endsGame: { kind: 'nominated-marked-executed', winner: 'good' } },
			c: { endsGame: { kind: 'marked-executed', token: 'Grandchild', winner: 'evil' } },
			d: { endsGame: { kind: 'day-without-execution', day: 5, winner: 'good' } },
			e: { deadAtLeast: 1, notCreatedAfterDay: 5 }
		};
		expect(readJinxRules(good, 'jinxes', issues)).toEqual(good);
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { endsGame: { kind: 'marked-executed', winner: 'evil' } },
				b: { endsGame: { kind: 'day-without-execution', winner: 'good' } },
				c: { endsGame: { kind: 'nominated-marked-executed', winner: 'good', day: 5 } },
				d: { endsGame: { kind: 'sometimes', winner: 'good' } },
				e: { deadAtLeast: 0, notCreatedAfterDay: 2.5 }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.endsGame.token',
			'jinxes.a',
			'jinxes.b.endsGame.day',
			'jinxes.b',
			'jinxes.c.endsGame.day',
			'jinxes.d.endsGame.kind',
			'jinxes.d',
			'jinxes.e.deadAtLeast',
			'jinxes.e.notCreatedAfterDay',
			'jinxes.e'
		]);
	});

	it('names only tokens the partner has, in each endsGame jinx', () => {
		for (const character of data.characters) {
			for (const [partner, rule] of Object.entries(rulesOf(character.id)?.jinxes ?? {})) {
				const token = rule.endsGame?.token;
				if (token === undefined) continue;
				const reminders = data.byId.get(partner)?.reminders ?? [];
				expect(reminders, `${character.id}.jinxes.${partner}`).toContain(token);
			}
		}
	});

	it("reads only the owner's side for what one character does to the other", () => {
		const of = (ids: string[]): Script => ({
			meta: { name: 'Jinxed' },
			entries: ids.map((id) => ({ kind: 'official' as const, id }))
		});
		const script = of(['spy', 'chef', 'imp']);
		const both = { script: of(['spy', 'chef', 'imp', 'ogre']) };
		expect(ownJinxRules(both, 'spy', 'ogre')?.registersTo).toEqual({
			alignments: ['evil'],
			always: true
		});
		expect(ownJinxRules(both, 'ogre', 'spy')).toBeUndefined();
		// Not in effect unless the script holds both.
		expect(ownJinxRules({ script }, 'spy', 'ogre')).toBeUndefined();
		expect(ownJinxes(both, 'spy', (r) => r.registersTo !== undefined)).toEqual([
			{ partner: 'ogre', rule: { registersTo: { alignments: ['evil'], always: true } } }
		]);
		expect(jinxedWith(both, 'ogre', (r) => r.registersTo !== undefined)).toEqual([
			{ characterId: 'spy', rule: { registersTo: { alignments: ['evil'], always: true } } }
		]);
	});

	it('adds a jinx registration to the usual ones, or replaces them when always', () => {
		const usual = {
			alignments: ['evil', 'good'] as const,
			types: ['minion', 'townsfolk'] as const
		};
		expect(registeredTo(usual, { alignments: ['evil'], always: true })).toEqual({
			alignments: ['evil'],
			types: ['minion', 'townsfolk']
		});
		expect(
			registeredTo({ alignments: ['good'], types: ['townsfolk'] }, { alignments: ['evil'] })
		).toEqual({ alignments: ['good', 'evil'], types: ['townsfolk'] });
		expect(
			registeredTo({ alignments: ['evil'], types: ['minion'] }, { types: ['demon'], always: true })
		).toEqual({ alignments: ['evil'], types: ['demon'] });
	});

	it("reads a custom character's own jinx rules", () => {
		const custom = new Map([
			['giver', { rules: { jinxes: { chef: { notGiven: true as const } } } }]
		]);
		expect(barredAbilities('giver', ['giver', 'chef', 'empath'], custom)).toEqual(['chef']);
	});

	it("reads a custom character's givenInstead and partner keys", () => {
		const custom = new Map([
			[
				'giver',
				{
					rules: {
						jinxes: {
							spy: { givenInstead: 'a-minion' as const },
							chef: { spareToken: true as const, noTurnGood: true as const }
						}
					}
				}
			]
		]);
		const script = ['giver', 'chef', 'spy', 'empath'];
		expect(givenInstead('giver', 'spy', script, custom)).toBe('a-minion');
		expect(givenInstead('giver', 'chef', script, custom)).toBeUndefined();
		expect(givenInstead('giver', 'spy', ['giver'], custom)).toBeUndefined();
		expect(jinxedPartners('giver', 'spareToken', script, custom)).toEqual(['chef']);
		expect(jinxedPartners('giver', 'noTurnGood', script, custom)).toEqual(['chef']);
		expect(jinxedPartners('giver', 'storytellerPicksPlayer', script, custom)).toEqual([]);
	});
});
