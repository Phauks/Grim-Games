/**
 * The wiki-example scenario helper (M13a): seats by place or character, steps that return a
 * new scenario, and refused commands that throw.
 */
import { describe, expect, it } from 'vitest';
import { scenario } from './scenario.ts';

describe('scenario', () => {
	const base = scenario(['chef', 'empath', 'imp']);

	it('names seats by place in the cast or by character', () => {
		expect(base.seat(2)).toBe(base.seat('imp'));
		expect(base.game.seats[base.seat('empath')].characterId).toBe('empath');
		expect(() => base.seat('monk')).toThrow('no seat monk');
	});

	it('branches: each step returns a new scenario', () => {
		const dead = base.dies('chef', 'demon');
		expect(dead.game.seats[dead.seat('chef')]).toMatchObject({ dead: true, deathCause: 'demon' });
		expect(base.game.seats[base.seat('chef')].dead).toBe(false);
	});

	it('places reminders, rule characters, nominations and executions', () => {
		const s = scenario(['chef', 'empath', 'monk', 'imp'])
			.drunk('chef')
			.poisoned('empath')
			.rule('bigwig')
			.nominate('chef', 'imp')
			.nomineeChose('monk')
			.execute('imp');
		expect(s.game.seats[s.seat('chef')].reminders.map((r) => r.label)).toEqual(['Is The Drunk']);
		expect(s.game.seats[s.seat('empath')].reminders.map((r) => r.label)).toEqual(['Poisoned']);
		expect(s.game.ruleCharacters).toEqual(['bigwig']);
		expect(s.game.today.entries.map((e) => e.kind)).toEqual(['nomination', 'execution']);
		expect(s.game.today.entries[0]).toMatchObject({ chosen: s.seat('monk') });
		expect(s.newDay().game.today.entries).toEqual([]);
	});

	it('throws on a refused command, naming it', () => {
		expect(() => base.do({ type: 'SetDead', seatId: 'nobody', dead: true })).toThrow(
			'SetDead refused'
		);
		expect(() => base.nomineeChose('chef')).toThrow('needs a nomination');
	});
});
