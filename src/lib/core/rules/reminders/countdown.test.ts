/**
 * Counting a token down each night (`countdown`): the Courtier's Drunk 1, 2, 3, then off
 * (https://wiki.bloodontheclocktower.com/Courtier).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { countdownMoves } from './countdown.ts';

describe('countdownMoves', () => {
	const base = scenario(['courtier', 'chef', 'imp']);

	it('swaps each Courtier token for the next, the last coming off', () => {
		const one = base.reminder('imp', 'courtier', 'Drunk 1');
		expect(countdownMoves(one.game, 'courtier', one.characters)).toMatchObject([
			{ seatId: one.seat('imp'), from: 'Drunk 1', to: 'Drunk 2' }
		]);
		const three = base.reminder('imp', 'courtier', 'Drunk 3');
		const [last] = countdownMoves(three.game, 'courtier', three.characters);
		expect(last).toMatchObject({ from: 'Drunk 3' });
		expect('to' in last).toBe(false);
	});

	it('leaves out tokens placed since dawn, and other characters’ tokens', () => {
		const dawn = base.newDay();
		const tonight = dawn.reminder('imp', 'courtier', 'Drunk 1').poisoned('chef');
		expect(countdownMoves(tonight.game, 'courtier', tonight.characters, dawn.game)).toEqual([]);
		expect(countdownMoves(tonight.game, 'chef', tonight.characters)).toEqual([]);
	});

	it('reads two or more of the character’s own reminders', () => {
		const issues = new Issues();
		parseCharacterRules({ countdown: { tokens: ['Drunk 3'] } }, 'x', issues);
		parseCharacterRules({ countdown: { tokens: ['A', 'B'] } }, 'y', issues, ['A']);
		expect(issues.list).toEqual([
			'x.countdown.tokens: expected two or more reminders, in the order placed',
			'y.countdown.tokens: not this character’s reminders: B'
		]);
	});
});
