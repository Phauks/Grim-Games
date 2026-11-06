/**
 * TPI `special` hooks on a custom character become rules parts (M58, P7), so a script from
 * another tool behaves like our official characters: the Thief
 * (https://wiki.bloodontheclocktower.com/Thief), the Organ Grinder
 * (https://wiki.bloodontheclocktower.com/Organ_Grinder) and the Wraith
 * (https://wiki.bloodontheclocktower.com/Wraith).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { toScript, loadScript } from './script.ts';
import { voteWorth } from '#lib/core/rules/vote-weights.ts';

const data = committedGameData();

const pickpocket = {
	id: 'pickpocket',
	name: 'Pickpocket',
	team: 'minion',
	ability: 'Each night, choose a player: their vote counts negatively tomorrow.',
	reminders: ['Robbed'],
	special: [{ type: 'vote', name: 'multiplier', value: -1 }]
};

const rulesOf = (entry: object) => loadScript([entry, 'imp'], data).script?.characters[0].rules;

describe('TPI special hooks as parts', () => {
	it('reads a vote multiplier as a vote weight on its reminder', () => {
		// Wiki (Thief): "Each night, choose a player (not yourself): their vote counts negatively tomorrow."
		expect(rulesOf(pickpocket)).toEqual({ voteWeight: { reminder: 'Robbed', weight: -1 } });
		const script = toScript(
			loadScript([pickpocket, 'chef', 'empath', 'monk', 'imp'], data).script!
		);
		const s = scenario(['pickpocket', 'chef', 'empath', 'monk', 'imp'], { script }).reminder(
			'chef',
			'pickpocket',
			'Robbed'
		);
		expect(voteWorth(s.game, s.seat('chef'), s.characters)).toBe(-1);
	});

	it('keeps its own vote weight, and skips a multiplier with no single reminder to carry it', () => {
		const own = { voteWeight: { self: true, weight: 2 } };
		expect(rulesOf({ ...pickpocket, rules: own })).toEqual(own);
		expect(rulesOf({ ...pickpocket, reminders: ['Robbed', 'Other'] })).toBeUndefined();
	});

	it('reads a hidden vote as secret voting and night open eyes as waking with evil', () => {
		// Wiki (Organ Grinder): "All players keep their eyes closed when voting and the vote tally is secret. Each night, choose if you are drunk until dusk."
		const grinder = { ...pickpocket, reminders: [], special: [{ type: 'vote', name: 'hidden' }] };
		expect(rulesOf(grinder)).toEqual({ voting: { secret: true } });
		// Wiki (Wraith): "You may choose to open your eyes at night. You wake when other evil players do."
		const wraith = {
			...pickpocket,
			reminders: [],
			special: [{ type: 'player', name: 'open-eyes', time: 'night' }]
		};
		expect(rulesOf(wraith)).toEqual({ wakesWithEvil: true });
	});
});
