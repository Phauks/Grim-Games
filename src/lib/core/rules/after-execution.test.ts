/**
 * Tokens an execution death places by itself (`afterExecution`): the Minstrel's Everyone Is
 * Drunk after a Minion dies by execution, never after a Traveller's exile, and only while the
 * Minstrel lives and has their ability. https://wiki.bloodontheclocktower.com/Minstrel
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

const drunkTokens = (s: Scenario) =>
	s.game.seats[s.seat('minstrel')].reminders.filter((r) => r.label === 'Everyone Is Drunk');

describe('afterExecution', () => {
	const cast = ['minstrel', 'poisoner', 'chef', 'empath', 'imp', 'beggar'];
	const table = () =>
		scenario(cast).becomes('beggar', 'beggar', 'evil').becomes('poisoner', 'poisoner');

	it('places the token when a Minion dies by execution, once', () => {
		const s = table().execute('poisoner');
		expect(drunkTokens(s)).toMatchObject([{ characterId: 'minstrel' }]);
		// Already on: a second Minion's execution adds none.
		const again = s.becomes('chef', 'spy', 'evil').execute('chef');
		expect(drunkTokens(again)).toHaveLength(1);
	});

	it('places none for a Townsfolk, a surviving Minion or a Traveller', () => {
		expect(drunkTokens(table().execute('chef'))).toEqual([]);
		expect(drunkTokens(table().dies('poisoner').execute('poisoner'))).toEqual([]);
		expect(drunkTokens(table().do((at) => ({ type: 'Exile', seatId: at.seat('beggar') })))).toEqual(
			[]
		);
	});

	it('places none while the Minstrel is dead or has no ability', () => {
		expect(drunkTokens(table().dies('minstrel').execute('poisoner'))).toEqual([]);
		expect(drunkTokens(table().drunk('minstrel').execute('poisoner'))).toEqual([]);
	});

	it('reads a character type and one of its own tokens', () => {
		const issues = new Issues();
		const ok = parseCharacterRules(
			{ afterExecution: { of: 'minion', token: 'Drunk' } },
			'x',
			issues,
			['Drunk']
		);
		expect(ok?.afterExecution).toEqual({ of: 'minion', token: 'Drunk' });
		expect(issues.list).toEqual([]);
		const bad = parseCharacterRules(
			{ afterExecution: { of: 'goblin', token: 'Other' } },
			'x',
			issues,
			['Drunk']
		);
		expect(bad?.afterExecution).toBeUndefined();
		expect(issues.list.length).toBeGreaterThan(0);
	});
});
