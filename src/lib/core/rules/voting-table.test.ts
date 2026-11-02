/**
 * Voting rules for the whole table (M9b), from the `voting` part:
 * - Voudon: https://wiki.bloodontheclocktower.com/Voudon (only the Voudon and the dead vote,
 *   ghost votes are not spent, the most votes wins with no majority needed);
 * - Organ Grinder: https://wiki.bloodontheclocktower.com/Organ_Grinder (secret votes, open
 *   while it chooses to be drunk);
 * - Ferryman: https://wiki.bloodontheclocktower.com/Ferryman (the dead regain their vote
 *   token on the final day).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { voteHints } from './vote-weights.ts';
import { blockThreshold, ghostVotesLeft, townCounts, votesWithoutToken } from './voting.ts';
import {
	deadVoteFree,
	ghostVotesRestored,
	mayVote,
	mostVotesWins,
	tableVoting,
	townVoting,
	votesSecret
} from './voting-table.ts';

type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

const latest = (s: Scenario) =>
	s.game.today.entries.findLast((e): e is Nomination => e.kind === 'nomination')!;
const record = (s: Scenario, voters: SeatRef[]): Command => ({
	type: 'RecordVotes',
	entryId: latest(s).entryId,
	voters: voters.map((v) => s.seat(v))
});
const warnings = (s: Scenario, ...voters: SeatRef[]) => warned(s.session, s.ctx, record(s, voters));
const hint = (s: Scenario, ref: SeatRef) =>
	voteHints(s.game, s.characters).find((h) => h.seatId === s.seat(ref))!;

describe('Voudon', () => {
	const cast = ['voudon', 'chef', 'empath', 'monk', 'zealot', 'banshee', 'imp', 'poisoner'];
	const withDead = () => scenario(cast).dies('chef', 'imp').dies('empath', 'imp');

	it('needs one vote and no majority while the Voudon’s ability works', () => {
		const s = withDead();
		expect(mostVotesWins(s.game, s.characters)).toBe('voudon');
		expect(blockThreshold(s.game, s.characters)).toEqual({
			alive: 6,
			needed: 1,
			mostVotes: 'voudon'
		});
		// Without the characters, the plain count: half the living.
		expect(blockThreshold(s.game)).toEqual({ alive: 6, needed: 3 });
	});

	it('lets only the Voudon and the dead vote', () => {
		const s = withDead();
		expect(mayVote(s.game, s.seat('voudon'), s.characters)).toEqual({ ok: true });
		expect(mayVote(s.game, s.seat('chef'), s.characters)).toEqual({ ok: true });
		expect(mayVote(s.game, s.seat('monk'), s.characters)).toEqual({ ok: false, by: 'voudon' });
		expect(hint(s, 'monk').mayNotVote).toEqual({ characterId: 'voudon' });
		expect(hint(s, 'voudon').mayNotVote).toBeUndefined();
	});

	it('warns on a living voter other than the Voudon, and spends no ghost vote', () => {
		const s = withDead().nominate('monk', 'imp');
		expect(warnings(s, 'voudon', 'chef', 'empath')).toEqual([]);
		expect(warnings(s, 'monk')).toEqual(['may-not-vote']);
		const voted = s.do(record(s, ['chef']));
		expect(voted.game.seats[s.seat('chef')].ghostVoteUsed).toBe(false);
		expect(latest(voted).votes).toEqual({ voters: [s.seat('chef')] });
		// Dead players may vote on every nomination that day.
		const again = voted.nominate('monk', 'poisoner');
		expect(warnings(again, 'chef')).toEqual([]);
	});

	it('does not warn that a living Zealot failed to vote, since they may not', () => {
		const s = withDead().nominate('monk', 'imp');
		expect(warnings(s, 'chef')).toEqual([]);
		expect(hint(s, 'zealot').mustVote).toBeUndefined();
	});

	it('gives every dead player a free vote, even one already spent', () => {
		const spent = scenario(cast)
			.dies('chef', 'imp')
			.do((s) => ({ type: 'SpendGhostVote', seatId: s.seat('chef') }))
			.dies('empath', 'imp');
		expect(deadVoteFree(spent.game, spent.characters)).toBe(true);
		expect(votesWithoutToken(spent.game, spent.seat('chef'), spent.characters)).toBe(1);
		expect(votesWithoutToken(spent.game, spent.seat('monk'), spent.characters)).toBeUndefined();
		expect(hint(spent, 'chef').ghostVote).toBe('free');
		expect(ghostVotesLeft(spent.game, spent.characters)).toBe(2);
	});

	it('leaves a Banshee killed by the Demon her two votes', () => {
		const s = withDead().dies('banshee', 'imp');
		expect(votesWithoutToken(s.game, s.seat('banshee'), s.characters)).toBe(2);
	});

	it('stops once the Voudon is dead or poisoned: the living vote and need a majority', () => {
		for (const s of [withDead().dies('voudon'), withDead().poisoned('voudon')]) {
			expect(tableVoting(s.game, s.characters)).toEqual([]);
			expect(blockThreshold(s.game, s.characters).mostVotes).toBeUndefined();
			expect(mayVote(s.game, s.seat('monk'), s.characters)).toEqual({ ok: true });
			expect(hint(s, 'chef').ghostVote).toBe('unused');
		}
	});
});

describe('Organ Grinder', () => {
	const cast = ['organgrinder', 'chef', 'empath', 'monk', 'imp'];

	it('makes votes secret while sober and alive', () => {
		const s = scenario(cast);
		expect(votesSecret(s.game, s.characters)).toBe(true);
		expect(tableVoting(s.game, s.characters)).toEqual([
			{ characterId: 'organgrinder', seatId: s.seat('organgrinder'), rule: { secret: true } }
		]);
	});

	it('leaves votes open the day it chose to be drunk, and once it is dead', () => {
		const drunk = scenario(cast).reminder('organgrinder', 'organgrinder', 'Drunk');
		expect(votesSecret(drunk.game, drunk.characters)).toBe(false);
		const dead = scenario(cast).dies('organgrinder');
		expect(votesSecret(dead.game, dead.characters)).toBe(false);
	});

	it('changes nothing else: the usual majority, and ghost votes are spent', () => {
		const s = scenario(cast).dies('chef', 'imp').nominate('monk', 'imp');
		expect(blockThreshold(s.game, s.characters)).toEqual({ alive: 4, needed: 2 });
		const voted = s.do(record(s, ['chef']));
		expect(voted.game.seats[s.seat('chef')].ghostVoteUsed).toBe(true);
	});

	it('is secret when the Storyteller holds its ability (the Plague Doctor’s Minion)', () => {
		const s = scenario(['chef', 'empath', 'imp']);
		const game = { ...s.game, storytellerAbilities: [{ characterId: 'organgrinder', via: 'x' }] };
		expect(votesSecret(game, s.characters)).toBe(true);
	});
});

describe('Ferryman', () => {
	const cast = ['chef', 'empath', 'monk', 'soldier', 'imp'];

	it('gives every dead player who spent their vote token it back on the final day', () => {
		const s = scenario(cast)
			.rule('ferryman')
			.dies('chef', 'imp')
			.dies('empath', 'imp')
			.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat('chef') }));
		expect(ghostVotesRestored(s.game, s.characters, true)).toEqual([s.seat('chef')]);
		// Not before the final day, which the Storyteller calls.
		expect(ghostVotesRestored(s.game, s.characters, false)).toEqual([]);
	});

	it('does nothing while the Ferryman is not in play', () => {
		const s = scenario(cast)
			.dies('chef', 'imp')
			.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat('chef') }));
		expect(ghostVotesRestored(s.game, s.characters, true)).toEqual([]);
	});
});

describe('townVoting and townCounts', () => {
	it('counts the Voudon’s rules from the Travellers the town knows', () => {
		const s = scenario(['chef']);
		const seats = [
			{ dead: false, traveller: 'voudon' },
			{ dead: false },
			{ dead: false },
			{ dead: true, ghostVote: 'used' as const },
			{ dead: true, ghostVote: 'unused' as const }
		];
		const table = townVoting(seats, s.characters);
		expect(table).toEqual({ noMajority: true, deadNeedNoToken: true });
		expect(townCounts(seats, table)).toMatchObject({ alive: 3, needed: 1, ghostVotes: 2 });
		expect(townCounts(seats)).toMatchObject({ alive: 3, needed: 2, ghostVotes: 1 });
		// A dead Voudon has no ability.
		const exiled = townVoting([{ dead: true, traveller: 'voudon' }], s.characters);
		expect(exiled).toEqual({});
	});
});
