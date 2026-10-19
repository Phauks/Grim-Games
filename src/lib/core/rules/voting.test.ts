/**
 * Votes needed for the block: at least half the living players
 * (https://wiki.bloodontheclocktower.com/Rules_Explanation, Glossary "Execution").
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import {
	blockThreshold,
	counts,
	ghostVotesLeft,
	livingByTeam,
	seatsBehind,
	type DayCount
} from './voting.ts';

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

describe('ghostVotesLeft', () => {
	// https://wiki.bloodontheclocktower.com/Dead_Player: each dead player has one vote left.
	it('counts the dead who have not spent their vote', () => {
		const { session, ctx, seats } = newGame(5);
		expect(ghostVotesLeft(session.game)).toBe(0);
		const g = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SetDead', seatId: seats[1], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[1] }
		).game;
		expect(ghostVotesLeft(g)).toBe(1);
	});
});

describe('seatsBehind', () => {
	it('lists the seats each day count is made of, and counts the same number', () => {
		const { session, ctx, seats } = newGame(5);
		const g = run(
			session,
			ctx,
			...['imp', 'chef', 'empath', 'poisoner'].map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			{ type: 'SetDead', seatId: seats[1], dead: true },
			{ type: 'SetDead', seatId: seats[2], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[2] }
		).game;
		expect(seatsBehind(g, 'alive')).toEqual(seats);
		expect(seatsBehind(g, 'good')).toEqual([]);
		expect(seatsBehind(g, 'evil')).toEqual([seats[0], seats[3]]);
		expect(seatsBehind(g, 'ghostVotes')).toEqual([seats[1], seats[2]]);
		const total = (count: DayCount) =>
			seatsBehind(g, count).filter((s) => counts(g, count, s)).length;
		const teams = livingByTeam(g);
		expect(total('alive')).toBe(teams.alive);
		expect(total('good')).toBe(teams.good);
		expect(total('evil')).toBe(teams.evil);
		expect(total('ghostVotes')).toBe(ghostVotesLeft(g));
	});
});
