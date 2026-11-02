/**
 * Vote helpers for wiki example tests (M9): record who raised a hand on the day's latest
 * nomination, read its tally, and see what the engine warns. Built on `scenario`.
 */
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { tallyOf } from '#lib/core/rules/vote-weights.ts';
import type { Scenario, SeatRef } from './scenario.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

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
