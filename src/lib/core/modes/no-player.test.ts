/**
 * The Ballad of Seat 7's seat no one plays, and speaking for it
 * (https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/). Not a character, so no wiki page:
 * the tests quote the author's page.
 */
import { describe, expect, it } from 'vitest';
import { newGame, refused, run, warned } from '#lib/core/model/fixtures.test-support.ts';
import { noPlayerSeats, seatMayVote, speakingLeft, spokeFor } from './no-player.ts';
import type { SeatsRule } from './types.ts';

const ONCE: SeatsRule = { kind: 'storyteller-seat', count: 1, speaks: 'once-per-game' };
const RISE_UP: SeatsRule = { ...ONCE, votes: 'once-per-day' };
const WHISPER: SeatsRule = { kind: 'storyteller-seat', count: 1, speaks: 'private-and-public' };

describe('the seat no one plays', () => {
	// Author's page: "Seat 7 remains empty." Trevor (2026-11-12): "Can be any seat. Ballad of
	// seat 7 could be used in any player count."
	it('is whichever seat the Storyteller marks', () => {
		const { session, ctx, seats } = newGame(8);
		const marked = run(session, ctx, { type: 'SetNoPlayer', seatId: seats[2], noPlayer: true });
		expect(marked.game.seats[seats[2]].noPlayer).toBe(true);
		expect(noPlayerSeats(session.game, ONCE)).toEqual([]);
		expect(noPlayerSeats(marked.game, ONCE)).toEqual([seats[2]]);
		expect(noPlayerSeats(marked.game, undefined)).toEqual([]);
		expect(warned(marked, ctx, { type: 'SetNoPlayer', seatId: seats[2], noPlayer: true })).toEqual([
			'no-change'
		]);
		const back = run(marked, ctx, { type: 'SetNoPlayer', seatId: seats[2], noPlayer: false });
		expect(back.game.seats[seats[2]].noPlayer).toBeUndefined();
	});

	// Author's page: "Once per game the storyteller may speak on its behalf."
	it('may be spoken for once a game', () => {
		const { session, ctx, seats } = newGame(7);
		const seat = seats[6];
		const marked = run(session, ctx, { type: 'SetNoPlayer', seatId: seat, noPlayer: true });
		expect(speakingLeft(marked.game, seat, ONCE)).toEqual(['once']);
		const spoke = run(marked, ctx, { type: 'SpeakForSeat', seatId: seat });
		expect(spokeFor(spoke.game, seat)).toHaveLength(1);
		expect(speakingLeft(spoke.game, seat, ONCE)).toEqual([]);
		// Still counted on a later day.
		const later = run(spoke, ctx, { type: 'NewDay' });
		expect(speakingLeft(later.game, seat, ONCE)).toEqual([]);
	});

	// Author's page, A Terrifying Whisper: "The Seat may speak twice per game. Once privately and
	// once publicly."
	it('may be spoken for once privately and once publicly under A Terrifying Whisper', () => {
		const { session, ctx, seats } = newGame(7);
		const seat = seats[6];
		const marked = run(session, ctx, { type: 'SetNoPlayer', seatId: seat, noPlayer: true });
		expect(speakingLeft(marked.game, seat, WHISPER)).toEqual(['private', 'public']);
		const spoke = run(marked, ctx, { type: 'SpeakForSeat', seatId: seat, how: 'private' });
		expect(speakingLeft(spoke.game, seat, WHISPER)).toEqual(['public']);
		expect(refused(spoke, ctx, { type: 'SpeakForSeat', seatId: seat, how: 'loud' as never })).toBe(
			'invalid-spoke'
		);
	});

	it('warns when the Storyteller speaks for a seat that has a player', () => {
		const { session, ctx, seats } = newGame(7);
		expect(warned(session, ctx, { type: 'SpeakForSeat', seatId: seats[0] })).toEqual([
			'has-player'
		]);
	});

	// Author's page, Seats Rise Up: "Once per day, if the seat still has a vote, the storyteller
	// may choose one nomination and a vote to it's total."
	it('may add its vote once a day under Seats Rise Up, with its ghost vote once dead', () => {
		const { session, ctx, seats } = newGame(7);
		const seat = seats[6];
		const marked = run(session, ctx, { type: 'SetNoPlayer', seatId: seat, noPlayer: true });
		expect(seatMayVote(marked.game, seat, ONCE)).toBe(false);
		expect(seatMayVote(marked.game, seat, RISE_UP)).toBe(true);
		const voted = run(marked, ctx, { type: 'VoteForSeat', seatId: seat });
		expect(seatMayVote(voted.game, seat, RISE_UP)).toBe(false);
		expect(warned(voted, ctx, { type: 'VoteForSeat', seatId: seat })).toEqual(['already-used']);
		const tomorrow = run(
			voted,
			ctx,
			{ type: 'NewDay' },
			{ type: 'SetDead', seatId: seat, dead: true }
		);
		expect(seatMayVote(tomorrow.game, seat, RISE_UP)).toBe(true);
		const ghost = run(tomorrow, ctx, { type: 'VoteForSeat', seatId: seat });
		expect(ghost.game.seats[seat].ghostVoteUsed).toBe(true);
		const next = run(ghost, ctx, { type: 'NewDay' });
		// "if the seat still has a vote": a dead seat that spent its ghost vote has none.
		expect(seatMayVote(next.game, seat, RISE_UP)).toBe(false);
		// Taking the vote back off the log gives the ghost vote back.
		const entry = ghost.game.today.entries.find((e) => e.kind === 'seat-vote')!;
		const undone = run(ghost, ctx, { type: 'RemoveDayEntry', entryId: entry.entryId });
		expect(undone.game.seats[seat].ghostVoteUsed).toBe(false);
	});
});
