/**
 * The voting examples on the wiki pages of the Trouble Brewing characters whose abilities
 * change votes (M9a), paraphrased, each recorded with `RecordVotes` and checked with
 * `tallyOf`, `voteHints` and the engine's warnings:
 * - Thief: https://wiki.bloodontheclocktower.com/Thief (Examples)
 * - Bureaucrat: https://wiki.bloodontheclocktower.com/Bureaucrat (Examples)
 * - Butler: https://wiki.bloodontheclocktower.com/Butler (Examples)
 * - Beggar: https://wiki.bloodontheclocktower.com/Beggar (Examples)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { tallyOf, voteHints } from './vote-weights.ts';
import { blockThreshold } from './voting.ts';

type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

const latest = (s: Scenario) =>
	s.game.today.entries.findLast((e): e is Nomination => e.kind === 'nomination')!;
const record = (s: Scenario, voters: SeatRef[]): Command => ({
	type: 'RecordVotes',
	entryId: latest(s).entryId,
	voters: voters.map((v) => s.seat(v))
});
const votes = (s: Scenario, ...voters: SeatRef[]) => s.do(record(s, voters));
const warnings = (s: Scenario, ...voters: SeatRef[]) => warned(s.session, s.ctx, record(s, voters));
const total = (s: Scenario) => tallyOf(s.game, latest(s), s.characters)?.total;
const give = (from: SeatRef, to: SeatRef) => (s: Scenario) => ({
	type: 'GiveVoteToken' as const,
	from: s.seat(from),
	to: s.seat(to)
});

const ten = [
	'thief',
	'bureaucrat',
	'chef',
	'empath',
	'monk',
	'soldier',
	'mayor',
	'slayer',
	'imp',
	'poisoner'
];

describe('Thief examples', () => {
	it('Example 1: the chosen player’s vote takes the count down by one', () => {
		// Seven hands go up; the Thief's chosen player (the monk) is the fourth counted, so the
		// count goes 1, 2, 3, then back to 2, and ends on 5.
		const s = votes(
			scenario(ten).reminder('monk', 'thief', 'Negative Vote').nominate('chef', 'imp'),
			'chef',
			'empath',
			'thief',
			'monk',
			'soldier',
			'mayor',
			'slayer'
		);
		expect(total(s)).toBe(5);
	});

	it('Example 2: six hands make four, short of the five that 10 living players need', () => {
		const s = votes(
			scenario(ten).reminder('chef', 'thief', 'Negative Vote').nominate('empath', 'imp'),
			'chef',
			'empath',
			'monk',
			'soldier',
			'mayor',
			'slayer'
		);
		expect(total(s)).toBe(4);
		expect(blockThreshold(s.game)).toEqual({ alive: 10, needed: 5 });
	});
});

describe('Bureaucrat examples', () => {
	it('Example 1: the chosen player’s one hand counts as three', () => {
		// Five hands: 1, 2, 3, then 4-5-6 for the chosen player, then 7.
		const s = votes(
			scenario(ten).reminder('monk', 'bureaucrat', '3 Votes').nominate('chef', 'imp'),
			'chef',
			'empath',
			'thief',
			'monk',
			'soldier'
		);
		expect(total(s)).toBe(7);
	});

	it('Example 2: the triple vote counts on every nomination that day', () => {
		let s = scenario(ten).reminder('mayor', 'bureaucrat', '3 Votes');
		const nominees: SeatRef[] = ['imp', 'poisoner', 'chef', 'empath'];
		const nominators: SeatRef[] = ['monk', 'soldier', 'slayer', 'thief'];
		nominees.forEach((nominee, i) => {
			s = votes(s.nominate(nominators[i], nominee), 'mayor');
			expect(total(s)).toBe(3);
		});
	});

	it('Example 3: a dead chosen player spends their vote token, and it counts as three', () => {
		const s = scenario(ten)
			.dies('soldier', 'imp')
			.reminder('soldier', 'bureaucrat', '3 Votes')
			.nominate('chef', 'imp');
		const voted = votes(s, 'soldier');
		expect(total(voted)).toBe(3);
		expect(voted.game.seats[s.seat('soldier')].ghostVoteUsed).toBe(true);
	});
});

describe('Butler examples', () => {
	const cast = ['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner'];

	it('Example 1: the Butler may vote when their Master votes, and not otherwise', () => {
		const s = scenario(cast).reminder('monk', 'butler', 'Master').nominate('chef', 'imp');
		expect(warnings(s, 'monk', 'butler')).toEqual([]);
		expect(warnings(s, 'butler')).toEqual(['only-votes-with']);
	});

	it('Example 2: the Master lowers their hand, so the Butler’s vote is illegal', () => {
		// The Storyteller still records it (and tallies it), with a warning.
		const s = scenario(cast).reminder('monk', 'butler', 'Master').nominate('chef', 'imp');
		const recorded = votes(s, 'butler', 'empath');
		expect(latest(recorded).votes?.voters).toEqual([s.seat('butler'), s.seat('empath')]);
		expect(warnings(s, 'butler', 'empath')).toEqual(['only-votes-with']);
	});

	it('Example 3: a dead Butler has no ability and votes freely with their vote token', () => {
		const s = scenario(cast)
			.reminder('monk', 'butler', 'Master')
			.dies('butler', 'imp')
			.nominate('chef', 'imp');
		expect(warnings(s, 'butler')).toEqual([]);
		expect(votes(s, 'butler').game.seats[s.seat('butler')].ghostVoteUsed).toBe(true);
	});
});

describe('Beggar examples', () => {
	const cast = ['beggar', 'monk', 'recluse', 'chef', 'empath', 'imp', 'poisoner'];
	const hint = (s: Scenario) =>
		voteHints(s.game, s.characters).find((h) => h.seatId === s.seat('beggar'))!;

	it('Example 1: the dead Monk gives her token, and the Beggar may vote once', () => {
		const s = scenario(cast).dies('monk', 'imp').nominate('chef', 'imp');
		expect(warnings(s, 'beggar')).toEqual(['no-vote-token']);
		const given = s.do(give('monk', 'beggar'));
		expect(given.game.seats[s.seat('monk')].ghostVoteUsed).toBe(true);
		expect(hint(given).needsToken?.tokens).toBe(1);
		const voted = votes(given, 'beggar');
		expect(hint(voted).needsToken?.tokens).toBe(0);
		// Once used, the token is gone: on the next nomination the Beggar has none.
		const next = voted.nominate('empath', 'poisoner');
		expect(warnings(next, 'beggar')).toEqual(['no-vote-token']);
	});

	it('Example 2: a Beggar with four tokens dies and keeps only their own ghost vote', () => {
		let s = scenario(cast);
		for (const dead of ['monk', 'chef', 'empath', 'recluse']) s = s.dies(dead, 'imp');
		for (const dead of ['monk', 'chef', 'empath', 'recluse']) s = s.do(give(dead, 'beggar'));
		expect(hint(s).needsToken?.tokens).toBe(4);
		const beggarDead = s.dies('beggar', 'imp');
		expect(hint(beggarDead).needsToken).toBeUndefined();
		expect(hint(beggarDead).ghostVote).toBe('unused');
		// Their one vote spends their ghost vote, not a given token.
		const voted = votes(beggarDead.nominate('imp', 'poisoner'), 'beggar');
		expect(voted.game.seats[s.seat('beggar')].ghostVoteUsed).toBe(true);
		expect(latest(voted).votes?.tokens).toBeUndefined();
	});
});
