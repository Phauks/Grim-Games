import { describe, expect, it } from 'vitest';
import {
	publish,
	newRoom,
	join,
	openScriptVote,
	castScriptBallot,
	closeScriptVote,
	endScriptVote,
	showScriptVoteTally,
	hostView,
	playerView,
	setChoosing
} from './room.ts';
import {
	MAX_SCRIPT_VOTE_OPTIONS,
	cleanBallot,
	newScriptVote,
	rankedRunoff,
	tallyScriptVote
} from './script-vote.ts';
import type { PublicGameState } from './public-projection.ts';

// Trevor, 2026-10-20 (plan R1): the Storyteller offers scripts; players vote by single
// choice, multiple choice or ranking. Not capped at two or three (Trevor, 2026-10-23).

const options = [
	{ id: 'tb', name: 'Trouble Brewing' },
	{ id: 'bmr', name: 'Bad Moon Rising' },
	{ id: 'recent:x', name: '  Whale   Buffet ', author: 'Someone' }
];

const table: PublicGameState = { seats: [], today: { nominations: [], executions: [] } };

function room() {
	let r = publish(newRoom('hash'), 'g1', table);
	for (const m of ['alex', 'bo', 'cy']) r = join(r, m)!;
	return r;
}

describe('a vote on the next script', () => {
	it("keeps each script's logo, only as script-logo.ts gives one (Trevor, 2026-10-24)", () => {
		const vote = newScriptVote('v1', 'single', [
			{ id: 'tb', name: 'Trouble Brewing', logo: '/data/logos/tb.webp' },
			{ id: 'a', name: 'A', logo: 'https://example.com/a.png' },
			{ id: 'b', name: 'B', logo: 'javascript:alert(1)' },
			{ id: 'c', name: 'C', logo: '/data/logos/../secret' }
		])!;
		expect(vote.options.map((o) => o.logo)).toEqual([
			'/data/logos/tb.webp',
			'https://example.com/a.png',
			undefined,
			undefined
		]);
	});

	it('offers two or more scripts, each once, with tidy names', () => {
		const vote = newScriptVote('v1', 'single', options)!;
		expect(vote.options[2]).toEqual({ id: 'recent:x', name: 'Whale Buffet', author: 'Someone' });
		expect(newScriptVote('v1', 'single', options.slice(0, 1))).toBeUndefined();
		const many = (n: number) =>
			Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `S${i}` }));
		expect(newScriptVote('v1', 'single', many(5))?.options).toHaveLength(5);
		expect(newScriptVote('v1', 'single', many(MAX_SCRIPT_VOTE_OPTIONS))).toBeDefined();
		expect(newScriptVote('v1', 'single', many(MAX_SCRIPT_VOTE_OPTIONS + 1))).toBeUndefined();
		expect(newScriptVote('v1', 'single', [options[0], options[0]])).toBeUndefined();
		expect(newScriptVote('v1', 'plurality', options)).toBeUndefined();
		expect(newScriptVote('', 'single', options)).toBeUndefined();
	});

	it('takes only a ballot that fits how players vote', () => {
		const single = newScriptVote('v', 'single', options)!;
		expect(cleanBallot(single, ['tb'])).toEqual(['tb']);
		expect(cleanBallot(single, ['tb', 'bmr'])).toBeUndefined();
		const multiple = newScriptVote('v', 'multiple', options)!;
		expect(cleanBallot(multiple, ['tb', 'bmr'])).toEqual(['tb', 'bmr']);
		expect(cleanBallot(multiple, [])).toBeUndefined();
		expect(cleanBallot(multiple, ['tb', 'tb'])).toBeUndefined();
		const ranked = newScriptVote('v', 'ranked', options)!;
		expect(cleanBallot(ranked, ['bmr', 'tb', 'recent:x'])).toEqual(['bmr', 'tb', 'recent:x']);
		// A ranking need not place every script (Trevor, 2026-10-26: players rearrange what
		// they selected).
		expect(cleanBallot(ranked, ['bmr', 'tb'])).toEqual(['bmr', 'tb']);
		expect(cleanBallot(ranked, [])).toBeUndefined();
		expect(cleanBallot(ranked, ['bmr', 'tb', 'snv'])).toBeUndefined();
	});

	it("keeps each script's characters for its details, homebrew with name and team", () => {
		const vote = newScriptVote('v', 'single', [
			{
				id: 'a',
				name: 'A',
				characters: [
					{ id: 'washerwoman' },
					{ id: 'washerwoman' },
					{ id: 'pilgrim', name: '  The   Pilgrim ', team: 'townsfolk' },
					{ id: '' },
					'imp'
				]
			},
			{ id: 'b', name: 'B', characters: [] }
		])!;
		expect(vote.options[0].characters).toEqual([
			{ id: 'washerwoman' },
			{ id: 'pilgrim', name: 'The Pilgrim', team: 'townsfolk' }
		]);
		expect(vote.options[1]).not.toHaveProperty('characters');
	});

	// Trevor, 2026-10-26: "Rank choice voting should attempt for majority from 1 vote. If 1
	// vote does not win, remove any votes for lowest and move down".
	describe('a ranked vote is an instant runoff', () => {
		it('wins outright with more than half the first choices', () => {
			const result = rankedRunoff(['a', 'b', 'c'], [['a'], ['a', 'b'], ['b', 'a']]);
			expect(result).toEqual({ rounds: [{ a: 2, b: 1, c: 0 }], out: {}, winner: 'a' });
		});

		it('drops the lowest and moves its ballots to their next choice', () => {
			const ballots = [['a'], ['a'], ['b'], ['b'], ['c', 'b']];
			expect(rankedRunoff(['a', 'b', 'c'], ballots)).toEqual({
				rounds: [
					{ a: 2, b: 2, c: 1 },
					{ a: 2, b: 3 }
				],
				out: { c: 1 },
				winner: 'b'
			});
		});

		it('counts a ballot with no choices left as no longer counting', () => {
			// After c goes, its ballot counts for nothing: 2 of the 3 left is a majority.
			const result = rankedRunoff(['a', 'b', 'c'], [['a'], ['a'], ['b'], ['c']]);
			expect(result.out).toEqual({ c: 1 });
			expect(result.winner).toBe('a');
			expect(result.rounds[1]).toEqual({ a: 2, b: 1 });
		});

		it('breaks a tie for lowest by an earlier round, then by the order offered', () => {
			// Round 2: b and c tie for lowest; b had fewer in round 1, so b goes, though c is
			// offered later.
			const a = Array.from({ length: 4 }, () => ['a']);
			const c = Array.from({ length: 3 }, () => ['c']);
			const earlier = rankedRunoff(['a', 'b', 'c', 'd'], [...a, ['b'], ['b'], ...c, ['d', 'b']]);
			expect(earlier.out).toEqual({ d: 1, b: 2 });
			expect(earlier.winner).toBe('a');
			// No earlier round tells them apart: the one offered later goes.
			expect(rankedRunoff(['a', 'b', 'c'], [['a'], ['a'], ['b'], ['c']]).out).toEqual({ c: 1 });
		});

		it('has no winner when every script left has the same count', () => {
			expect(rankedRunoff(['a', 'b'], [['a'], ['b']])).toEqual({
				rounds: [{ a: 1, b: 1 }],
				out: {}
			});
			expect(rankedRunoff(['a', 'b'], []).winner).toBeUndefined();
		});

		it('gives the Storyteller each script’s last-round votes, when it went, and the winner', () => {
			const vote = {
				...newScriptVote('v', 'ranked', options)!,
				ballots: {
					alex: ['tb', 'bmr'],
					bo: ['bmr', 'tb'],
					cy: ['recent:x', 'tb'],
					dee: ['tb'],
					gone: ['recent:x', 'bmr']
				}
			};
			// Someone who left the room no longer counts.
			const tally = tallyScriptVote(vote, ['alex', 'bo', 'cy', 'dee']);
			expect(tally.points).toEqual({ tb: 3, bmr: 1, 'recent:x': 1 });
			expect(tally.out).toEqual({ 'recent:x': 1 });
			expect(tally.winner).toBe('tb');
			expect(tally.rounds).toEqual([
				{ tb: 2, bmr: 1, 'recent:x': 1 },
				{ tb: 3, bmr: 1 }
			]);
			expect(tally.voted).toBe(4);
			expect(tally.members).toBe(4);
		});
	});

	// Trevor, 2026-10-26: "can back out".
	it('takes back a ballot that is withdrawn', () => {
		let r = openScriptVote(room(), 'v1', 'multiple', options);
		r = castScriptBallot(r, 'alex', 'v1', ['tb']);
		expect(hostView(r).scriptVote?.voted).toBe(1);
		r = castScriptBallot(r, 'alex', 'v1', []);
		expect(hostView(r).scriptVote?.voted).toBe(0);
		expect(playerView(r, 'alex').scriptVote?.choices).toBeUndefined();
		expect(castScriptBallot(r, 'alex', 'v1', [])).toBe(r);
	});

	// Trevor, 2026-10-30: "End vote should end vote. No 15 second delay" (replacing the
	// 2026-10-26 final call).
	it('ends at once', () => {
		let r = openScriptVote(room(), 'v1', 'single', options, undefined, 0);
		r = castScriptBallot(r, 'alex', 'v1', ['tb'], 1000);
		r = endScriptVote(r, 5000);
		expect(r.scriptVote).toMatchObject({ endsAt: 5000 });
		expect(playerView(r, 'alex').scriptVote).toMatchObject({ endsAt: 5000 });
		expect(hostView(r).scriptVote).toMatchObject({ endsAt: 5000, voted: 1 });
		// No ballot is taken or changed after it ends, and ending again changes nothing.
		expect(castScriptBallot(r, 'alex', 'v1', ['bmr'], 5000)).toBe(r);
		expect(castScriptBallot(r, 'alex', 'v1', [], 5000)).toBe(r);
		expect(endScriptVote(r, 9000)).toBe(r);
		// A time limit ends at once too, and one that already ran out stands.
		const timed = openScriptVote(room(), 'v1', 'single', options, 5, 0);
		expect(endScriptVote(timed, 20_000).scriptVote?.endsAt).toBe(20_000);
		const ran = openScriptVote(room(), 'v1', 'single', options, 1, 0);
		expect(endScriptVote(ran, 70_000)).toBe(ran);
		expect(endScriptVote(room(), 0)).toEqual(room());
	});

	// Trevor, 2026-10-26: "storytellers can see if they want to let players see the vote".
	it('shows players the count only when the Storyteller lets them', () => {
		let r = openScriptVote(room(), 'v1', 'single', options);
		r = castScriptBallot(r, 'bo', 'v1', ['bmr']);
		expect(playerView(r, 'alex').scriptVote).not.toHaveProperty('tally');
		r = showScriptVoteTally(r, true);
		// Who has voted, never what they chose (Trevor, 2026-10-26: the same stats for all).
		expect(playerView(r, 'alex').scriptVote?.tally).toEqual({
			points: { tb: 0, bmr: 1, 'recent:x': 0 },
			voted: 1,
			members: 3,
			people: [{ voted: false }, { voted: true }, { voted: false }]
		});
		expect(hostView(r).scriptVote?.people).toEqual(playerView(r, 'alex').scriptVote?.tally?.people);
		// Counted over the phones here now, as the Storyteller's count is.
		expect(playerView(r, 'alex', new Set(['alex'])).scriptVote?.tally?.members).toBe(2);
		expect(showScriptVoteTally(r, true)).toBe(r);
		expect(showScriptVoteTally(r, 'yes')).toBe(r);
		expect(playerView(showScriptVoteTally(r, false), 'alex').scriptVote).not.toHaveProperty(
			'tally'
		);
		const shown = openScriptVote(room(), 'v2', 'ranked', options, undefined, 0, undefined, true);
		expect(shown.scriptVote?.showTally).toBe(true);
		expect(playerView(shown, 'cy').scriptVote?.tally?.voted).toBe(0);
	});

	// Trevor, 2026-10-23: "Room vote should allow for voting on a game mode as well".
	it('can be on the game mode, which phones are told', () => {
		const modes = [
			{ id: 'standard', name: 'Standard' },
			{ id: 'sushi-buffet', name: 'Sushi Buffet' }
		];
		const r = openScriptVote(room(), 'v1', 'single', modes, undefined, 0, 'mode');
		expect(playerView(r, 'alex').scriptVote?.subject).toBe('mode');
		expect(hostView(r).scriptVote?.subject).toBe('mode');
		expect(
			playerView(openScriptVote(room(), 'v1', 'single', modes), 'alex').scriptVote
		).not.toHaveProperty('subject');
	});

	// Trevor, 2026-10-26: "Voting should allow selecting game modes vs scripts, along with
	// special rules".
	it('can be on the special rules, which phones are told', () => {
		const rules = [
			{ id: 'plus-one', name: '+1' },
			{ id: 'warrens', name: 'Warrens' }
		];
		const r = openScriptVote(room(), 'v1', 'multiple', rules, undefined, 0, 'rules');
		expect(playerView(r, 'alex').scriptVote?.subject).toBe('rules');
		expect(hostView(r).scriptVote?.subject).toBe('rules');
		// Anything else is a script vote, as from apps before.
		expect(
			playerView(openScriptVote(room(), 'v1', 'single', rules, undefined, 0, 'other'), 'alex')
				.scriptVote
		).not.toHaveProperty('subject');
	});

	it('runs in the room: phones see it with their own ballot, the Storyteller the count', () => {
		let r = openScriptVote(room(), 'v1', 'multiple', options);
		r = castScriptBallot(r, 'alex', 'v1', ['tb', 'bmr']);
		r = castScriptBallot(r, 'bo', 'v1', ['bmr']);
		// A stale vote id or a stranger changes nothing.
		expect(castScriptBallot(r, 'bo', 'v0', ['tb'])).toBe(r);
		expect(castScriptBallot(r, 'zed', 'v1', ['tb'])).toBe(r);
		expect(playerView(r, 'alex').scriptVote).toEqual({
			voteId: 'v1',
			kind: 'multiple',
			options: newScriptVote('v1', 'multiple', options)!.options,
			choices: ['tb', 'bmr']
		});
		expect(playerView(r, 'cy').scriptVote?.choices).toBeUndefined();
		expect(hostView(r).scriptVote?.points).toEqual({ tb: 1, bmr: 2, 'recent:x': 0 });
		// Ballots never reach other phones.
		expect(JSON.stringify(playerView(r, 'cy'))).not.toContain('alex');
		expect(closeScriptVote(r).scriptVote).toBeUndefined();
	});

	// Trevor, 2026-10-23: "storyteller can create time-limit for vote".
	it('takes no more ballots once its time limit runs out', () => {
		let r = openScriptVote(room(), 'v1', 'single', options, 2, 1000);
		expect(r.scriptVote?.endsAt).toBe(1000 + 2 * 60_000);
		expect(playerView(r, 'alex').scriptVote?.endsAt).toBe(121_000);
		expect(hostView(r).scriptVote?.endsAt).toBe(121_000);
		r = castScriptBallot(r, 'alex', 'v1', ['tb'], 120_999);
		expect(hostView(r).scriptVote?.voted).toBe(1);
		expect(castScriptBallot(r, 'bo', 'v1', ['bmr'], 121_000)).toBe(r);
		// Only the listed limits; anything else is a vote with no limit.
		expect(openScriptVote(room(), 'v1', 'single', options, 7, 0).scriptVote).not.toHaveProperty(
			'endsAt'
		);
		expect(openScriptVote(room(), 'v1', 'single', options).scriptVote).not.toHaveProperty('endsAt');
		expect(
			castScriptBallot(openScriptVote(room(), 'v1', 'single', options), 'bo', 'v1', ['tb'], 9e12)
				.scriptVote?.ballots.bo
		).toEqual(['tb']);
	});

	it('ends, with the Storyteller choosing, when the next game starts', () => {
		let r = setChoosing(openScriptVote(room(), 'v1', 'single', options), true);
		expect(playerView(r, 'alex').choosing).toBe(true);
		expect(setChoosing(r, 'yes')).toBe(r);
		r = publish(r, 'g2', table);
		expect(r.choosing).toBeUndefined();
		expect(r.scriptVote).toBeUndefined();
		expect(playerView(setChoosing(room(), true), 'alex').choosing).toBe(true);
		expect(setChoosing(setChoosing(room(), true), false).choosing).toBeUndefined();
	});
});
