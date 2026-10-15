/**
 * Plain-words conditions for the Character reference page. They describe the conditions
 * `day-reminders.ts` evaluates; the reminders themselves cite their wiki pages in
 * `day-reminders.data.ts` (e.g. https://wiki.bloodontheclocktower.com/Banshee).
 */
import { describe, expect, it } from 'vitest';
import { describeCause, describeImpairable, describeWhen } from './describe.ts';

const witch = { name: 'Witch', type: 'minion' } as const;
const angel = { name: 'Angel', type: 'fabled' } as const;
const self = { self: true } as const;
const target = { target: true } as const;

describe('describeWhen', () => {
	it('defaults to the character being alive', () => {
		expect(describeWhen({ template: [self, { text: 'is alive' }] }, witch)).toBe('Witch is alive');
	});

	it('says one line per player when the sentence names the token carrier', () => {
		expect(
			describeWhen(
				{ template: [self, { text: 'has chosen' }, target], when: { reminder: 'Cursed' } },
				witch
			)
		).toBe('Witch is alive; a player has Witch’s “Cursed” reminder (one line per player)');
		expect(describeWhen({ template: [self], when: { reminder: 'Day 3' } }, witch)).toBe(
			'Witch is alive; a player has Witch’s “Day 3” reminder'
		);
	});

	it('describes dead, any, missing tokens and the alive count', () => {
		expect(describeWhen({ template: [self], when: { self: 'dead' } }, witch)).toBe('Witch is dead');
		expect(
			describeWhen(
				{ template: [self], when: { self: 'any', noReminder: 'No Ability', minAlive: 5 } },
				witch
			)
		).toBe(
			'Witch is in play, alive or dead; no player has Witch’s “No Ability” reminder; at least 5 players are alive'
		);
	});

	it('describes a death cause in plain words', () => {
		expect(
			describeWhen(
				{ template: [self], when: { self: 'dead', cause: ['demon'] } },
				{ name: 'Banshee', type: 'townsfolk' }
			)
		).toBe(
			'Banshee is dead, killed by the Demon (shown, marked uncertain, when the cause was not recorded)'
		);
		const name = (id: string) => (id === 'assassin' ? 'Assassin' : id);
		expect(describeCause('execution')).toBe('executed');
		expect(describeCause('assassin', name)).toBe('killed by the Assassin');
		expect(
			describeWhen(
				{ template: [self], when: { self: 'dead', cause: ['execution', 'other'] } },
				witch
			)
		).toContain('dead, executed or died some other way');
	});

	it('treats Fabled and Loric as in play, never alive or dead', () => {
		expect(describeWhen({ template: [self] }, angel)).toBe('Angel is in play');
		expect(describeWhen({ template: [self], when: { self: 'any' } }, angel)).toBe(
			'Angel is in play'
		);
	});

	it('shows conditions it does not know yet as raw data instead of hiding them', () => {
		const when = { future: 2 } as unknown as Record<string, never>;
		expect(describeWhen({ template: [self], when }, witch)).toBe('Witch is alive; future: 2');
	});
});

describe('describeImpairable', () => {
	it('names the character and the tokens', () => {
		expect(describeImpairable(witch)).toMatch(/^Witch is alive and a Poisoned or Drunk reminder/);
	});
});
