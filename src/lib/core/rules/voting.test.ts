/**
 * Votes needed for the block: at least half the living players
 * (https://wiki.bloodontheclocktower.com/Rules_Explanation, Glossary "Execution").
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { blockThreshold } from './voting.ts';

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
