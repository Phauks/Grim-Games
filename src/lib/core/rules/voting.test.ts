/**
 * Votes needed for the block: at least half the living players
 * (https://wiki.bloodontheclocktower.com/Rules_Explanation, Glossary "Execution").
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { publicProjection } from '#lib/core/sync/public-projection.ts';
import {
	blockThreshold,
	counts,
	townCounts,
	neededToExile,
	ghostVotesLeft,
	votesWithoutToken,
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
		expect(ghostVotesLeft(session.game, ctx.characters)).toBe(0);
		const g = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SetDead', seatId: seats[1], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[1] }
		).game;
		expect(ghostVotesLeft(g, ctx.characters)).toBe(1);
	});

	// https://wiki.bloodontheclocktower.com/Banshee: killed by the Demon, they vote twice on
	// every nomination with no vote token; killed another way, they are like any dead player.
	it('counts two votes, never spent, for a Banshee the Demon killed', () => {
		const die = (cause: 'demon' | 'execution') =>
			castGame(['banshee', 'chef', 'imp'], (s) => ({
				type: 'SetDead',
				seatId: s[0],
				dead: true,
				cause
			}));
		const byDemon = die('demon');
		expect(ghostVotesLeft(byDemon.session.game, byDemon.ctx.characters)).toBe(2);
		expect(votesWithoutToken(byDemon.session.game, byDemon.seats[0], byDemon.ctx.characters)).toBe(
			2
		);
		const executed = die('execution');
		expect(ghostVotesLeft(executed.session.game, executed.ctx.characters)).toBe(1);
		expect(
			votesWithoutToken(executed.session.game, executed.seats[0], executed.ctx.characters)
		).toBeUndefined();
	});
});

describe('townCounts', () => {
	// The Storyteller's counts, worked out the same way on players' phones from the town's view
	// (Rules_Explanation for the block, Dead_Player and Banshee for ghost votes).
	it("matches the Storyteller's alive count, votes to block and ghost votes", () => {
		const { session, ctx, seats } = newGame(7);
		const g = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SetDead', seatId: seats[1], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[1] }
		).game;
		const town = townCounts(
			publicProjection(g, undefined, undefined, undefined, ctx.characters).seats
		);
		expect(town).toEqual({
			...blockThreshold(g),
			total: 7,
			ghostVotes: ghostVotesLeft(g, ctx.characters)
		});
		expect(town).toEqual({ alive: 5, needed: 3, total: 7, ghostVotes: 1 });
	});

	it('counts a Banshee the Demon killed as two votes, as the Storyteller does', () => {
		const { session, ctx } = castGame(['banshee', 'chef', 'imp'], (s) => ({
			type: 'SetDead',
			seatId: s[0],
			dead: true,
			cause: 'demon'
		}));
		const seen = publicProjection(session.game, undefined, undefined, undefined, ctx.characters);
		expect(townCounts(seen.seats).ghostVotes).toBe(ghostVotesLeft(session.game, ctx.characters));
		expect(townCounts(seen.seats).ghostVotes).toBe(2);
	});

	// Glossary "Exile" and "Player": at least half of every player, alive or dead, Travellers
	// included; the Voudon page's example has 5 of 12 supporting fail.
	it('shows the players needed to exile while a living Traveller is in play', () => {
		const cast = ['beggar', 'chef', 'empath', 'monk', 'imp', 'poisoner', 'saint'];
		const isTraveller = (id: string) => id === 'beggar';
		const { session, ctx, seats } = castGame(cast, (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true
		}));
		const seen = publicProjection(session.game, isTraveller).seats;
		expect(townCounts(seen)).toMatchObject({ alive: 6, needed: 3, total: 7, exile: 4 });
		const gone = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true }).game;
		expect(townCounts(publicProjection(gone, isTraveller).seats)).not.toHaveProperty('exile');
		expect(townCounts(publicProjection(session.game, () => false).seats)).not.toHaveProperty(
			'exile'
		);
	});

	it('needs half of every player, rounded up, to exile', () => {
		expect([5, 7, 12, 15].map(neededToExile)).toEqual([3, 4, 6, 8]);
	});

	it('is zero of zero with nobody seated', () => {
		expect(townCounts([])).toEqual({ alive: 0, total: 0, needed: 0, ghostVotes: 0 });
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
			seatsBehind(g, count).reduce((sum, s) => sum + counts(g, count, s, ctx.characters), 0);
		const teams = livingByTeam(g);
		expect(total('alive')).toBe(teams.alive);
		expect(total('good')).toBe(teams.good);
		expect(total('evil')).toBe(teams.evil);
		expect(total('ghostVotes')).toBe(ghostVotesLeft(g, ctx.characters));
	});
});
