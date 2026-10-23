/**
 * Claims players make in town, by their rules block:
 * - https://wiki.bloodontheclocktower.com/Juggler (guesses up to 5 players' characters)
 * - https://wiki.bloodontheclocktower.com/Gossip (a public statement; if true, a player dies)
 * - https://wiki.bloodontheclocktower.com/Savant (two pieces of information, one true)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { correctGuesses, dayClaim } from './day-claims.ts';

describe('dayClaim', () => {
	it('reads each character’s claim from its rules block', () => {
		expect(dayClaim('juggler')).toBe('guesses');
		expect(dayClaim('gossip')).toBe('statement');
		expect(dayClaim('savant')).toBe('statements');
		expect(dayClaim('washerwoman')).toBeUndefined();
	});

	it('reads a custom character’s own block', () => {
		const custom = new Map([['herald', { rules: { dayClaim: 'statement' as const } }]]);
		expect(dayClaim('herald', custom)).toBe('statement');
	});
});

describe('correctGuesses', () => {
	it('counts a guess right only when it names the true character (a Drunk is the Drunk)', () => {
		const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat']);
		const s = run(
			session,
			ctx,
			...(['juggler', 'washerwoman', 'witch'] as const).map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		);
		expect(
			correctGuesses(
				s.game,
				[
					{ seatId: seats[1], characterId: 'washerwoman' },
					{ seatId: seats[2], characterId: 'witch' }
				],
				characters
			)
		).toEqual([seats[2]]);
	});
});
