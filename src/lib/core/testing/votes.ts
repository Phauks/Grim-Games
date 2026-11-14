/**
 * Vote helpers for wiki example tests (M9): record who raised a hand on the day's latest
 * nomination, read its tally, and see what the engine warns. Built on `scenario`.
 */
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { voteWorth } from '#lib/core/rules/day/vote-weights.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { Scenario, SeatRef } from './scenario.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** A nomination's recorded votes added up: each voter's worth, in seat order. */
export interface VoteTally {
	total: number;
	votes: { seatId: SeatId; worth: number }[];
}

/**
 * The tally of a nomination's recorded votes, or undefined while none are recorded. Each
 * vote counts as it would now (`voteWorth`): a weight that ended since the vote (the Thief
 * died) no longer shows.
 */
export function tallyOf(
	game: Game,
	nomination: Nomination,
	characters: CharacterLookup
): VoteTally | undefined {
	if (!nomination.votes) return undefined;
	const votes = nomination.votes.voters.map((seatId) => ({
		seatId,
		worth: voteWorth(game, seatId, characters)
	}));
	return { total: votes.reduce((sum, v) => sum + v.worth, 0), votes };
}

/** The day's latest nomination. */
export const latest = (s: Scenario) =>
	s.game.today.entries.findLast((e): e is Nomination => e.kind === 'nomination')!;

const record = (s: Scenario, voters: SeatRef[]): Command => ({
	type: 'RecordVotes',
	entryId: latest(s).entryId,
	voters: voters.map((v) => s.seat(v))
});

/** Records these voters on the latest nomination. */
export const votes = (s: Scenario, ...voters: SeatRef[]) => s.do(record(s, voters));

/** The warning codes recording these voters would give, without recording them. */
export const voteWarnings = (s: Scenario, ...voters: SeatRef[]) =>
	warned(s.session, s.ctx, record(s, voters));

/** The latest nomination's vote total, after vote weights. */
export const total = (s: Scenario) => tallyOf(s.game, latest(s), s.characters)?.total;

/** A command: one player gives their vote token to another (Beggar). */
export const giveVoteToken = (from: SeatRef, to: SeatRef) => (s: Scenario) => ({
	type: 'GiveVoteToken' as const,
	from: s.seat(from),
	to: s.seat(to)
});
