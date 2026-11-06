/**
 * The jinx values M46 replaced (saved game version 30): each old value becomes its new shape,
 * and the new shape reads without a problem (`readJinxRules`).
 */
import { describe, expect, it } from 'vitest';
import { readJinxRules } from './jinx-read.ts';
import { upgradeJinxRules, upgradeScriptJinxes } from './jinx-renames.ts';
import { Issues } from './validate.ts';

const OLD_TO_NEW: [string, unknown, unknown][] = [
	[
		'abnormalCounts own-ability',
		{ abnormalCounts: 'own-ability' },
		{ abnormalCounts: { counts: 'self-caused' } }
	],
	[
		'abnormalCounts demon-choice',
		{ abnormalCounts: 'demon-choice' },
		{ abnormalCounts: { counts: 'unlike-demon' } }
	],
	[
		'endsGame partner-chooses',
		{ endsGame: { kind: 'partner-chooses', chooser: 'partner' } },
		{ endsGame: { kind: 'night-instead', chooser: 'partner' } }
	],
	[
		'endsGame partner-stops',
		{ endsGame: { kind: 'partner-stops', winner: 'good', alive: 1 } },
		{ endsGame: { kind: 'ability-stopped', winner: 'good', alive: 1 } }
	],
	[
		'endsGame partner-end',
		{ endsGame: { kind: 'partner-end', winner: 'evil' } },
		{ endsGame: { kind: 'gained-end', end: 'dead-without-demon', winner: 'evil' } }
	],
	['noBluffs', { noBluffs: true }, { notShown: { what: 'bluffs' } }],
	[
		'givenInstead outsiders',
		{ givenInstead: 'outsiders' },
		{ givenInstead: { instead: 'becomes', type: 'outsider', upTo: 2 } }
	],
	[
		'givenInstead demon-neighbour-becomes',
		{ givenInstead: 'demon-neighbour-becomes' },
		{ givenInstead: { instead: 'becomes', where: 'demon-good-neighbour' } }
	],
	[
		'givenInstead a-player-becomes',
		{ givenInstead: 'a-player-becomes' },
		{ givenInstead: { instead: 'becomes' } }
	],
	['storytellerVote', { storytellerVote: true }, { storytellerChooses: { what: 'own-execution' } }],
	[
		'storytellerHas removed',
		{ storytellerHas: 'removed' },
		{ storytellerHas: { once: 'changed' } }
	],
	['earlierToken', { earlierToken: 'Night 2' }, { changesCharacter: { token: 'Night 2' } }],
	[
		'neighbourBecomes',
		{ neighbourBecomes: 'minion' },
		{ alsoBecomes: { type: 'minion', players: 'neighbours' } }
	],
	[
		'noKill executed-partner',
		{ noKill: 'executed-partner' },
		{
			noKill: {
				killer: 'demon',
				when: ['nominated-partner', 'partner-executed', 'partner-dead']
			}
		}
	],
	[
		'demonLearnsGood',
		{ demonLearnsGood: true },
		{ learns: { what: 'good-players', who: 'partner', when: ['self-in-play'] } }
	],
	[
		'hidesPartnerSeat',
		{ hidesPartnerSeat: { when: ['self-alive'] } },
		{ notShown: { what: 'partner-seat', when: ['self-alive'] } }
	],
	['uncountedVote', { uncountedVote: true }, { voter: { countsOnlyWith: true } }],
	[
		'survivesCarrierExecuted',
		{ survivesCarrierExecuted: { when: ['partner-alive'] } },
		{ survives: { on: 'carrier-executed', when: ['partner-alive'] } }
	],
	['notShownGiven', { notShownGiven: true }, { notShown: { what: 'given-ability' } }],
	['keepsAfterPartner', { keepsAfterPartner: true }, { keepsAbility: { afterDeath: true } }],
	[
		'wakesOneByOne',
		{ wakesOneByOne: { when: ['partner-alive'] } },
		{ wakes: { how: 'one-by-one', when: ['partner-alive'] } }
	],
	[
		'storytellerChooses carrier',
		{ storytellerChooses: { what: 'carrier', when: ['partner-alive'] } },
		{ storytellerChooses: { what: 'player', via: 'carrierIsDemon', when: ['partner-alive'] } }
	]
];

describe('upgradeJinxRules', () => {
	it.each(OLD_TO_NEW)('turns %s into its M46 shape', (_name, old, upgraded) => {
		expect(upgradeJinxRules(old)).toEqual(upgraded);
	});

	it('gives shapes the jinx reader takes', () => {
		for (const [name, old] of OLD_TO_NEW) {
			const issues = new Issues();
			const read = readJinxRules({ partner: upgradeJinxRules(old) }, 'jinxes', issues);
			expect(issues.list, name).toEqual([]);
			expect(read?.partner, name).toBeDefined();
		}
	});

	it('leaves current values, and anything else, as they were', () => {
		const current = { impairs: { who: 'partner', kind: 'drunk' }, cannotChoose: true };
		expect(upgradeJinxRules(current)).toEqual(current);
		expect(upgradeJinxRules('text')).toBe('text');
	});

	it("upgrades a saved script's own jinxes and its custom characters' jinxes", () => {
		const script = {
			meta: { name: 'Homebrew' },
			entries: [
				{ kind: 'official', id: 'riot' },
				{
					kind: 'custom',
					character: { id: 'gloom', rules: { jinxes: { chef: { noBluffs: true } } } }
				}
			],
			jinxes: [{ characters: ['riot', 'atheist'], reason: 'r', rules: { storytellerVote: true } }]
		};
		expect(upgradeScriptJinxes(script)).toEqual({
			...script,
			entries: [
				script.entries[0],
				{
					kind: 'custom',
					character: {
						id: 'gloom',
						rules: { jinxes: { chef: { notShown: { what: 'bluffs' } } } }
					}
				}
			],
			jinxes: [{ ...script.jinxes[0], rules: { storytellerChooses: { what: 'own-execution' } } }]
		});
	});
});
