/**
 * `RecordVotes` and `GiveVoteToken` (M9a): who voted on a nomination, the ghost votes and vote
 * tokens it spends, and warnings, never refusals, for a vote the rules forbid. A dead player
 * has one ghost vote (https://wiki.bloodontheclocktower.com/Dead_Player); the Butler votes
 * only with their Master (/Butler), the Zealot must vote (/Zealot), the Beggar needs a vote
 * token (/Beggar), and the Banshee killed by the Demon votes without one (/Banshee).
 */
import { describe, expect, it } from 'vitest';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import type { Command } from './commands.ts';

type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

const latest = (s: Scenario) =>
	s.game.today.entries.findLast((e): e is Nomination => e.kind === 'nomination')!;

const record = (s: Scenario, voters?: SeatRef[]): Command => ({
	type: 'RecordVotes',
	entryId: latest(s).entryId,
	...(voters ? { voters: voters.map((v) => s.seat(v)) } : {})
});
const votes = (s: Scenario, ...voters: SeatRef[]) => s.do(record(s, voters));
const warnings = (s: Scenario, ...voters: SeatRef[]) => warned(s.session, s.ctx, record(s, voters));

const base = () => scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).nominate('chef', 'imp');

describe('RecordVotes', () => {
	it('records the voters in seat order, and clears them', () => {
		const s = votes(base(), 'monk', 'chef');
		expect(latest(s).votes).toEqual({ voters: [s.seat('chef'), s.seat('monk')] });
		expect(warned(s.session, s.ctx, record(s, ['chef', 'monk']))).toEqual(['no-change']);
		const cleared = s.do(record(s));
		expect(latest(cleared).votes).toBeUndefined();
		expect(warned(cleared.session, cleared.ctx, record(cleared))).toEqual(['no-change']);
	});

	it('records nobody voting', () => {
		const s = votes(base());
		expect(latest(s).votes).toEqual({ voters: [] });
	});

	it('spends a dead voter’s ghost vote, and gives it back when they are taken off', () => {
		const dead = base().dies('empath', 'imp');
		const s = votes(dead, 'empath');
		expect(s.game.seats[s.seat('empath')].ghostVoteUsed).toBe(true);
		expect(latest(s).votes).toEqual({ voters: [s.seat('empath')], ghostVotes: [s.seat('empath')] });
		// Re-recorded with the same voter plus another: the vote stays spent once.
		const more = votes(s, 'empath', 'chef');
		expect(latest(more).votes?.ghostVotes).toEqual([s.seat('empath')]);
		const off = votes(more, 'chef');
		expect(off.game.seats[s.seat('empath')].ghostVoteUsed).toBe(false);
		expect(latest(off).votes).toEqual({ voters: [s.seat('chef')] });
	});

	it('gives the ghost votes back when the nomination is removed', () => {
		const s = votes(base().dies('empath', 'imp'), 'empath');
		const removed = s.do({ type: 'RemoveDayEntry', entryId: latest(s).entryId });
		expect(removed.game.seats[s.seat('empath')].ghostVoteUsed).toBe(false);
	});

	it('warns on a dead voter with no ghost vote left, and records the vote anyway', () => {
		const s = base()
			.dies('empath', 'imp')
			.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat('empath') }));
		expect(warnings(s, 'empath')).toEqual(['no-ghost-vote']);
		const after = votes(s, 'empath');
		expect(latest(after).votes).toEqual({ voters: [s.seat('empath')] });
	});

	it('spends no ghost vote for a Banshee killed by the Demon', () => {
		const s = scenario(['banshee', 'chef', 'empath', 'imp', 'poisoner'])
			.dies('banshee', 'imp')
			.nominate('chef', 'imp');
		expect(warnings(s, 'banshee')).toEqual([]);
		const after = votes(s, 'banshee');
		expect(after.game.seats[s.seat('banshee')].ghostVoteUsed).toBe(false);
	});

	it('warns when the Butler votes without their Master, but not with them', () => {
		const s = scenario(['butler', 'chef', 'empath', 'imp', 'poisoner'])
			.reminder('empath', 'butler', 'Master')
			.nominate('chef', 'imp');
		expect(warnings(s, 'butler')).toEqual(['only-votes-with']);
		expect(warnings(s, 'butler', 'empath')).toEqual([]);
		// A drunk Butler has no ability to limit them.
		expect(warnings(s.poisoned('butler'), 'butler')).toEqual([]);
	});

	it('warns when the Zealot does not vote with 5 or more alive', () => {
		const s = scenario(['zealot', 'chef', 'empath', 'imp', 'poisoner']).nominate('chef', 'imp');
		expect(warnings(s, 'chef')).toEqual(['must-vote']);
		expect(warnings(s, 'chef', 'zealot')).toEqual([]);
		expect(warnings(s.dies('empath', 'imp'), 'chef')).toEqual([]);
	});

	it('uses a Beggar’s vote token, and warns when they have none', () => {
		const s = scenario(['beggar', 'chef', 'empath', 'imp', 'poisoner'])
			.dies('empath', 'imp')
			.nominate('chef', 'imp');
		expect(warnings(s, 'beggar')).toEqual(['no-vote-token']);
		const given = s.do((at) => ({
			type: 'GiveVoteToken',
			from: at.seat('empath'),
			to: at.seat('beggar')
		}));
		expect(given.game.seats[s.seat('empath')].ghostVoteUsed).toBe(true);
		expect(given.game.seats[s.seat('beggar')].voteTokens).toBe(1);
		const voted = votes(given, 'beggar');
		expect(voted.game.seats[s.seat('beggar')].voteTokens).toBeUndefined();
		expect(latest(voted).votes?.tokens).toEqual([s.seat('beggar')]);
		// Re-recording keeps the token spent once; taking the Beggar off gives it back.
		const again = votes(voted, 'beggar', 'chef');
		expect(again.game.seats[s.seat('beggar')].voteTokens).toBeUndefined();
		const off = votes(again, 'chef');
		expect(off.game.seats[s.seat('beggar')].voteTokens).toBe(1);
	});
});

describe('GiveVoteToken', () => {
	const s = scenario(['beggar', 'chef', 'empath', 'imp', 'poisoner']);
	const give = (at: Scenario, from: SeatRef, to: SeatRef): Command => ({
		type: 'GiveVoteToken',
		from: at.seat(from),
		to: at.seat(to)
	});

	it('warns when the giver is alive or has no vote, or the receiver needs no token', () => {
		expect(warned(s.session, s.ctx, give(s, 'chef', 'beggar'))).toEqual(['giver-not-dead']);
		const dead = s.dies('chef', 'imp');
		expect(warned(dead.session, dead.ctx, give(dead, 'chef', 'empath'))).toEqual([
			'needs-no-token'
		]);
		const spent = dead.do(give(dead, 'chef', 'beggar'));
		expect(warned(spent.session, spent.ctx, give(spent, 'chef', 'beggar'))).toEqual([
			'no-ghost-vote'
		]);
	});
});
