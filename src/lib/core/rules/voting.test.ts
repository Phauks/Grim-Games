/**
 * Votes needed for the block: at least half the living players
 * (https://wiki.bloodontheclocktower.com/Rules_Explanation, Glossary "Execution").
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { blockThreshold, livingByTeam } from './voting.ts';

describe('blockThreshold', () => {
	it('is half the living players, rounded up', () => {
		expect(blockThreshold(newGame(8).session.game)).toEqual({ alive: 8, needed: 4 });
		const { session: s7, ctx, seats: seats7 } = newGame(7);
		expect(blockThreshold(s7.game)).toEqual({ alive: 7, needed: 4 });
		const dead = run(
			s7,
			ctx,
			...[0, 1].map((i): Command => ({ type: 'SetDead', seatId: seats7[i], dead: true }))
		);
		expect(blockThreshold(dead.game)).toEqual({ alive: 5, needed: 3 });
	});
});

describe('livingByTeam', () => {
	it('counts the living on each team; the dead and unset alignments apart', () => {
		const { session, ctx, seats } = newGame(5);
		const g = run(
			session,
			ctx,
			...['imp', 'chef', 'empath', 'poisoner'].map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			{ type: 'SetDead', seatId: seats[2], dead: true }
		).game;
		expect(livingByTeam(g)).toEqual({ alive: 4, good: 1, evil: 2, unknown: 1 });
	});
});
