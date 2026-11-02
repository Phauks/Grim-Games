/**
 * What a vote counts for and who may vote (M9a): the `voteWeight` part (the Thief,
 * https://wiki.bloodontheclocktower.com/Thief; the Bureaucrat, /Bureaucrat; the God of Ug,
 * /God_of_Ug) and the `voter` part (the Butler, /Butler; the Zealot, /Zealot; the Beggar,
 * /Beggar), read by `voteWorth`, `tallyOf` and `voteHints`.
 */
import { describe, expect, it } from 'vitest';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import { tallyOf, voteHints, voteNotes, voteWorth } from './vote-weights.ts';

type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

const latest = (s: Scenario) =>
	s.game.today.entries.findLast((e): e is Nomination => e.kind === 'nomination')!;

/** Records who voted on the latest nomination. */
const votes = (s: Scenario, ...voters: SeatRef[]) =>
	s.do((at) => ({
		type: 'RecordVotes',
		entryId: latest(at).entryId,
		voters: voters.map((v) => at.seat(v))
	}));

const hintOf = (s: Scenario, ref: SeatRef) =>
	voteHints(s.game, s.characters).find((h) => h.seatId === s.seat(ref))!;

const cast = ['thief', 'bureaucrat', 'chef', 'empath', 'monk', 'imp', 'poisoner'];

describe('voteWorth', () => {
	it('is 1 for a vote nobody changed', () => {
		const s = scenario(cast);
		expect(voteWorth(s.game, s.seat('chef'), s.characters)).toBe(1);
	});

	// Thief: the chosen player's vote takes one away. Bureaucrat: it counts as three.
	it('follows the Thief’s and Bureaucrat’s reminders, and multiplies both on one player', () => {
		const s = scenario(cast).reminder('chef', 'thief', 'Negative Vote');
		expect(voteWorth(s.game, s.seat('chef'), s.characters)).toBe(-1);
		const both = s.reminder('chef', 'bureaucrat', '3 Votes');
		expect(voteWorth(both.game, both.seat('chef'), both.characters)).toBe(-3);
		const empath = s.reminder('empath', 'bureaucrat', '3 Votes');
		expect(voteWorth(empath.game, empath.seat('empath'), empath.characters)).toBe(3);
	});

	// Thief: the negative vote ends at once when the Thief dies; a drunk or poisoned Thief's
	// ability does nothing either.
	it('ignores a reminder whose character is dead, drunk or poisoned', () => {
		const s = scenario(cast).reminder('chef', 'thief', 'Negative Vote');
		const dead = s.dies('thief', 'exile');
		expect(voteWorth(dead.game, dead.seat('chef'), dead.characters)).toBe(1);
		const poisoned = s.poisoned('thief');
		expect(voteWorth(poisoned.game, poisoned.seat('chef'), poisoned.characters)).toBe(1);
	});

	// God of Ug: the hat's wearer votes twice. A Loric has no seat, so its token always counts.
	it('counts the Ug hat’s wearer twice', () => {
		const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner'])
			.rule('godofug')
			.reminder('monk', 'godofug', 'Hat');
		expect(voteWorth(s.game, s.seat('monk'), s.characters)).toBe(2);
	});

	// Bureaucrat example 3: a dead chosen player's one vote counts as three.
	it('weights a dead player’s ghost vote too', () => {
		const s = scenario(cast).dies('monk', 'imp').reminder('monk', 'bureaucrat', '3 Votes');
		expect(voteWorth(s.game, s.seat('monk'), s.characters)).toBe(3);
	});
});

describe('tallyOf', () => {
	it('is undefined until votes are recorded', () => {
		const s = scenario(cast).nominate('chef', 'imp');
		expect(tallyOf(s.game, latest(s), s.characters)).toBeUndefined();
	});

	it('adds up each voter’s worth, in seat order', () => {
		const s = votes(
			scenario(cast).reminder('chef', 'thief', 'Negative Vote').nominate('monk', 'imp'),
			'monk',
			'chef',
			'empath'
		);
		expect(tallyOf(s.game, latest(s), s.characters)).toEqual({
			total: 1,
			votes: [
				{ seatId: s.seat('chef'), worth: -1 },
				{ seatId: s.seat('empath'), worth: 1 },
				{ seatId: s.seat('monk'), worth: 1 }
			]
		});
	});

	// Banshee: killed by the Demon, they vote twice without a token.
	it('counts a Banshee killed by the Demon twice', () => {
		const s = votes(
			scenario(['banshee', 'chef', 'empath', 'imp', 'poisoner'])
				.dies('banshee', 'imp')
				.nominate('chef', 'imp'),
			'banshee'
		);
		expect(tallyOf(s.game, latest(s), s.characters)?.total).toBe(2);
	});
});

describe('voteHints', () => {
	it('lists every seat in play with its worth and what changes it', () => {
		const s = scenario(cast).reminder('chef', 'bureaucrat', '3 Votes');
		const hints = voteHints(s.game, s.characters);
		expect(hints).toHaveLength(cast.length);
		expect(hintOf(s, 'chef')).toEqual({
			seatId: s.seat('chef'),
			worth: 3,
			worthFrom: ['bureaucrat']
		});
		expect(hintOf(s, 'empath')).toEqual({ seatId: s.seat('empath'), worth: 1, worthFrom: [] });
	});

	it('marks a dead player’s ghost vote unused, used, or free', () => {
		const s = scenario(['banshee', 'chef', 'empath', 'imp', 'poisoner'])
			.dies('banshee', 'imp')
			.dies('chef', 'imp');
		expect(hintOf(s, 'chef').ghostVote).toBe('unused');
		expect(hintOf(s, 'banshee').ghostVote).toBe('free');
		const spent = s.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat('chef') }));
		expect(hintOf(spent, 'chef').ghostVote).toBe('used');
	});

	// Butler: votes only with the Master; once dead, freely with their ghost vote.
	it('names the Butler’s Master, while the Butler’s ability works', () => {
		const s = scenario(['butler', 'chef', 'empath', 'imp', 'poisoner']).reminder(
			'empath',
			'butler',
			'Master'
		);
		expect(hintOf(s, 'butler').onlyWith).toEqual({
			characterId: 'butler',
			seats: [s.seat('empath')]
		});
		expect(hintOf(s.dies('butler', 'imp'), 'butler').onlyWith).toBeUndefined();
		expect(hintOf(s.poisoned('butler'), 'butler').onlyWith).toBeUndefined();
	});

	// Zealot: must vote with 5 or more alive (Travellers count), free with 4 or fewer.
	it('says the Zealot must vote only while 5 or more players live', () => {
		const s = scenario(['zealot', 'chef', 'empath', 'monk', 'imp', 'poisoner']);
		expect(hintOf(s, 'zealot').mustVote).toEqual({ characterId: 'zealot' });
		const five = s.dies('chef', 'imp');
		expect(hintOf(five, 'zealot').mustVote).toEqual({ characterId: 'zealot' });
		const four = five.dies('empath', 'imp');
		expect(hintOf(four, 'zealot').mustVote).toBeUndefined();
	});

	// Beggar: needs a vote token while alive; a dead Beggar votes with their ghost vote.
	it('gives the Beggar’s vote tokens while alive', () => {
		const s = scenario(['beggar', 'chef', 'empath', 'imp', 'poisoner']);
		expect(hintOf(s, 'beggar').needsToken).toEqual({ characterId: 'beggar', tokens: 0 });
		const given = s
			.dies('chef', 'imp')
			.do((at) => ({ type: 'GiveVoteToken', from: at.seat('chef'), to: at.seat('beggar') }));
		expect(hintOf(given, 'beggar').needsToken).toEqual({ characterId: 'beggar', tokens: 1 });
		const dead = given.dies('beggar', 'imp');
		expect(hintOf(dead, 'beggar').needsToken).toBeUndefined();
		expect(hintOf(dead, 'beggar').ghostVote).toBe('unused');
	});
});

// Votes are run outside the app (Trevor, 2026-11-01), so the Storyteller counts from notes.
describe('voteNotes', () => {
	it('lists only the seats whose vote is unusual today', () => {
		const s = scenario(['butler', 'thief', 'chef', 'empath', 'imp', 'poisoner'])
			.reminder('chef', 'thief', 'Negative Vote')
			.reminder('empath', 'butler', 'Master');
		expect(voteNotes(s.game, s.characters).map((n) => n.seatId)).toEqual([
			s.seat('butler'),
			s.seat('chef')
		]);
	});

	it('is empty when every vote counts once', () => {
		const s = scenario(cast);
		expect(voteNotes(s.game, s.characters)).toEqual([]);
	});
});
