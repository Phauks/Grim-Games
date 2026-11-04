/**
 * Jinxes on a script. https://wiki.bloodontheclocktower.com/Djinn
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import { OFFICIAL_RULES, rulesOf } from '#lib/core/data/rules/index.ts';
import {
	activeJinxes,
	barredAbilities,
	givenInstead,
	isExclusiveJinx,
	jinxedPartners,
	jinxIsExclusive,
	jinxesOnStep,
	jinxRulesBetween,
	jinxSetupWarnings,
	jinxedWith,
	ownJinxes,
	ownJinxRules,
	registeredTo,
	scriptJinxes
} from './jinxes.ts';
import { readJinxRules } from '#lib/core/data/jinx-read.ts';
import { jinxPartnerIssues } from '#lib/core/data/jinx-needs.ts';
import { Issues, type Json } from '#lib/core/data/validate.ts';
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
		expect(jinxRulesBetween('boffin', 'drunk')).toEqual({ cannotCreate: { via: 'givesAbility' } });
		// The Boffin's rule is about the Boffin only, so the Drunk's side has none.
		expect(jinxRulesBetween('drunk', 'boffin')).toBeUndefined();
		// The Spy's file says what happens to the Damsel (`who: "partner"`), read from her side,
		// with the condition turned round to hers.
		expect(jinxRulesBetween('damsel', 'spy')).toEqual({
			impairs: { kind: 'poisoned', when: ['partner-in-play'] }
		});
		expect(jinxRulesBetween('spy', 'damsel')).toBeUndefined();
		expect(jinxRulesBetween('chambermaid', 'mathematician')).toBeUndefined();
	});

	it('reads a bare main value, true, or an object with who and when', () => {
		const issues = new Issues();
		expect(
			readJinxRules(
				{
					a: { deadAtLeast: 1, impairs: 'drunk', notDeclared: true },
					b: {
						impairs: { who: 'both', kind: 'drunk', unlessImpaired: true },
						grimoire: { hides: ['partner', 'demon'], when: ['partner-in-play'] }
					},
					c: {
						cannotCreate: { via: 'changesCharacter', when: [{ afterDay: 5 }] },
						carriedBy: { marked: 'Is The Demon', who: 'partner' },
						learns: { what: 'no-ability', when: [{ night: 1 }, 'self-alive'] }
					}
				},
				'jinxes',
				issues
			)
		).toEqual({
			a: { deadAtLeast: { dead: 1 }, impairs: { kind: 'drunk' }, notDeclared: {} },
			b: {
				impairs: { who: 'both', kind: 'drunk', unlessImpaired: true },
				grimoire: { hides: ['partner', 'demon'], when: ['partner-in-play'] }
			},
			c: {
				cannotCreate: { via: 'changesCharacter', when: [{ afterDay: 5 }] },
				carriedBy: { marked: 'Is The Demon', who: 'partner' },
				learns: { what: 'no-ability', when: [{ night: 1 }, 'self-alive'] }
			}
		});
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { notDeclared: { who: 'both' } },
				b: { trueInfo: { when: ['sometimes'] } },
				c: { trueInfo: { when: [{ day: 0 }] } },
				d: { trueInfo: { when: [] } },
				e: { trueInfo: { when: [{ day: 1, night: 1 }] } },
				f: { trueInfo: { when: [{ hour: 1 }] } }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.notDeclared.who',
			'jinxes.a',
			'jinxes.b.trueInfo.when[0]',
			'jinxes.b',
			'jinxes.c.trueInfo.when[0].day',
			'jinxes.c',
			'jinxes.d.trueInfo.when',
			'jinxes.d',
			'jinxes.e.trueInfo.when[0]',
			'jinxes.e',
			'jinxes.f.trueInfo.when[0].hour',
			'jinxes.f'
		]);
	});

	it('reports an effect whose prerequisite is missing from its own rules block', () => {
		const issues = new Issues();
		readJinxRules({ a: { carriedBy: { type: 'minion' } } }, 'jinxes', issues, {});
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual(['jinxes.a.carriedBy']);
		const fine = new Issues();
		readJinxRules({ a: { carriedBy: { type: 'minion' } } }, 'jinxes', fine, {
			carrierIsDemon: {}
		});
		expect(fine.list).toEqual([]);
	});

	it('reads who chooses a carrier, waking one by one, and an alignment learned (M41)', () => {
		const issues = new Issues();
		const self = { carrierIsDemon: 'Is The Demon', changesCharacter: {} };
		expect(
			readJinxRules(
				{
					a: {
						storytellerChooses: { what: 'player', via: 'carrierIsDemon' },
						wakes: { how: 'one-by-one', when: ['partner-alive'] }
					},
					b: {
						learns: {
							what: 'alignment',
							when: [{ partnerMarked: 'Friend' }, { alignment: 'evil' }]
						}
					}
				},
				'jinxes',
				issues,
				self
			)
		).toEqual({
			a: {
				storytellerChooses: { what: 'player', via: 'carrierIsDemon' },
				wakes: { how: 'one-by-one', when: ['partner-alive'] }
			},
			b: {
				learns: { what: 'alignment', when: [{ partnerMarked: 'Friend' }, { alignment: 'evil' }] }
			}
		});
		expect(issues.list).toEqual([]);
		// A carrier needs a `carrierIsDemon` token; `creating` is only for a changed player.
		const bad = new Issues();
		readJinxRules(
			{
				a: { storytellerChooses: { what: 'player', via: 'carrierIsDemon' }, wakes: 'twice' },
				b: { storytellerChooses: { what: 'player', via: 'carrierIsDemon', creating: 'partner' } },
				c: { trueInfo: { when: [{ alignment: 'grey' }] } }
			},
			'jinxes',
			bad,
			{}
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.wakes.how',
			'jinxes.a.storytellerChooses',
			'jinxes.b.storytellerChooses.creating',
			'jinxes.b',
			'jinxes.c.trueInfo.when[0].alignment',
			'jinxes.c'
		]);
	});

	it('reports a prerequisite missing from the partner, and an effect both files set', () => {
		const rules = new Map<string, Json>([
			['a', { jinxes: { b: { impairs: { who: 'partner', kind: 'poisoned' } } } }],
			['b', { jinxes: { a: { impairs: { who: 'self', kind: 'drunk' } } } }]
		]);
		const read = (id: string) => {
			const raw = rules.get(id)!;
			return { jinxes: readJinxRules(raw.jinxes, 'jinxes', new Issues()) };
		};
		const issues = new Issues();
		jinxPartnerIssues('a', read('a').jinxes!, read, 'rules/a.json.jinxes', issues);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual(['rules/a.json.jinxes.b.impairs']);

		const needs = new Issues();
		jinxPartnerIssues(
			'a',
			readJinxRules({ b: { noKill: 'token' } }, 'jinxes', new Issues())!,
			() => ({}),
			'rules/a.json.jinxes',
			needs
		);
		expect(needs.list.map((i) => i.split(': ')[0])).toEqual(['rules/a.json.jinxes.b.noKill']);
	});

	it('reads the official rules with no partner prerequisite missing and no effect set twice', () => {
		const issues = new Issues();
		for (const [id, rules] of OFFICIAL_RULES)
			jinxPartnerIssues(
				id,
				rules.jinxes ?? {},
				(p) => OFFICIAL_RULES.get(p),
				`rules/${id}.json.jinxes`,
				issues
			);
		expect(issues.list).toEqual([]);
	});

	it('reads the jinx rules that reuse other rules, and rejects bad ones', () => {
		const issues = new Issues();
		expect(
			readJinxRules(
				{
					a: { registersTo: { alignments: ['evil'], always: true } },
					b: { impairs: { who: 'partner', kind: 'poisoned' }, noKill: 'token' },
					c: { grimoire: { hides: 'all' } }
				},
				'jinxes',
				issues
			)
		).toEqual({
			a: { registersTo: { alignments: ['evil'], always: true } },
			b: { impairs: { who: 'partner', kind: 'poisoned' }, noKill: { on: 'token' } },
			c: { grimoire: { hides: 'all' } }
		});
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { registersTo: { always: true } },
				b: { impairs: 'sober' },
				c: { noKill: 'sometimes' },
				d: { grimoire: ['minion', 'everyone'] }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.registersTo',
			'jinxes.a',
			'jinxes.b.impairs.kind',
			'jinxes.b',
			'jinxes.c.noKill.on',
			'jinxes.c',
			'jinxes.d.grimoire',
			'jinxes.d'
		]);
	});

	it('reads the Leviathan and Riot jinx rules, and rejects bad ones', () => {
		const issues = new Issues();
		const good = {
			a: { endsGame: { kind: 'nominated-marked-executed', winner: 'good', token: 'Safe' } },
			b: { endsGame: { kind: 'nominated-marked-executed', winner: 'good' } },
			c: { endsGame: { kind: 'marked-executed', token: 'Grandchild', winner: 'evil' } },
			d: { endsGame: { kind: 'day-without-execution', day: 5, winner: 'good' } },
			e: {
				deadAtLeast: { dead: 1, when: ['partner-in-play'] },
				cannotCreate: { via: 'changesCharacter', when: [{ afterDay: 5 }] }
			}
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
				e: {
					deadAtLeast: 0,
					cannotCreate: { via: 'changesCharacter', when: [{ afterDay: 2.5 }] }
				}
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
			'jinxes.c',
			'jinxes.d.endsGame.kind',
			'jinxes.d',
			'jinxes.e.cannotCreate.when[0].afterDay',
			'jinxes.e.deadAtLeast.dead',
			'jinxes.e'
		]);
	});

	it('reads the Vizier jinx rules, and rejects bad ones', () => {
		const issues = new Issues();
		const good = {
			a: { notDeclared: {}, keepsProtection: {}, learns: { what: 'partner-choice' } },
			b: {
				impairs: { who: 'partner', kind: 'no-ability', when: ['self-in-play'] },
				noExecuteNow: { player: 'partner' }
			},
			c: { noExecuteNow: { player: 'marked', token: 'Fear' } }
		};
		expect(readJinxRules(good, 'jinxes', issues)).toEqual(good);
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { noExecuteNow: 'marked' },
				b: { noExecuteNow: 'everyone' },
				c: { notDeclared: 'yes' }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.noExecuteNow.token',
			'jinxes.a',
			'jinxes.b.noExecuteNow.player',
			'jinxes.b',
			'jinxes.c.notDeclared',
			'jinxes.c'
		]);
	});

	it("reads Lil' Monsta's babysitting jinx rules, and rejects bad ones", () => {
		const issues = new Issues();
		const good = {
			a: { alsoBecomes: { type: 'minion' } },
			b: { carriedBy: { type: 'minion', when: ['partner-alive'] } },
			c: { carriedBy: { marked: 'Is The Demon' } },
			d: { diesWhenExecuted: { when: [{ marked: 'Is The Demon' }] } }
		};
		expect(readJinxRules(good, 'jinxes', issues)).toEqual(good);
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { alsoBecomes: 'goblin' },
				b: { carriedBy: { type: 'minion', marked: 'Is The Demon' } },
				c: { diesWhenExecuted: 3 }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.alsoBecomes.type',
			'jinxes.a',
			'jinxes.b.carriedBy',
			'jinxes.b',
			'jinxes.c.diesWhenExecuted',
			'jinxes.c'
		]);
	});

	it('reads the night choice jinx rules, and rejects bad ones', () => {
		const issues = new Issues();
		const good = {
			a: { nightChoice: { chooses: 'good', partner: 'acts' } },
			b: { nightChoice: { chooses: 'any', partner: 'dies' } }
		};
		expect(readJinxRules(good, 'jinxes', issues)).toEqual(good);
		expect(issues.list).toEqual([]);
		const bad = new Issues();
		readJinxRules(
			{
				a: { nightChoice: { chooses: 'evil', partner: 'acts' } },
				b: { nightChoice: { chooses: 'good' } },
				c: { nightChoice: { chooses: 'good', partner: 'acts', night: 2 } }
			},
			'jinxes',
			bad
		);
		expect(bad.list.map((i) => i.split(': ')[0])).toEqual([
			'jinxes.a.nightChoice.chooses',
			'jinxes.a',
			'jinxes.b.nightChoice.partner',
			'jinxes.b',
			'jinxes.c.nightChoice.night',
			'jinxes.c'
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
			['giver', { rules: { jinxes: { chef: { cannotCreate: { via: 'givesAbility' as const } } } } }]
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
							spy: { givenInstead: { instead: 'a-minion' as const } },
							chef: { spareToken: {}, noTurnGood: {} }
						}
					}
				}
			]
		]);
		const script = ['giver', 'chef', 'spy', 'empath'];
		expect(givenInstead('giver', 'spy', script, custom)).toEqual({ instead: 'a-minion' });
		expect(givenInstead('giver', 'chef', script, custom)).toBeUndefined();
		expect(givenInstead('giver', 'spy', ['giver'], custom)).toBeUndefined();
		expect(jinxedPartners('giver', 'spareToken', script, custom)).toEqual(['chef']);
		expect(jinxedPartners('giver', 'noTurnGood', script, custom)).toEqual(['chef']);
		expect(jinxedPartners('giver', 'storytellerPicksPlayer', script, custom)).toEqual([]);
	});

	it("reads a custom character's rule written in its partner's block", () => {
		// The rule lives with the giver, and is about the official partner (`who: "partner"`).
		const custom = new Map([
			[
				'giver',
				{
					rules: {
						jinxes: { chef: { impairs: { who: 'partner' as const, kind: 'drunk' as const } } }
					}
				}
			]
		]);
		expect(jinxRulesBetween('chef', 'giver', custom)).toEqual({ impairs: { kind: 'drunk' } });
		expect(jinxRulesBetween('giver', 'chef', custom)).toBeUndefined();
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
