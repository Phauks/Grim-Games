import { describe, expect, it } from 'vitest';
import {
	publish,
	newRoom,
	join,
	openScriptVote,
	castScriptBallot,
	closeScriptVote,
	hostView,
	playerView,
	setChoosing
} from './room.ts';
import {
	MAX_SCRIPT_VOTE_OPTIONS,
	cleanBallot,
	newScriptVote,
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
		expect(cleanBallot(ranked, ['bmr', 'tb'])).toBeUndefined();
		expect(cleanBallot(ranked, ['bmr', 'tb', 'snv'])).toBeUndefined();
	});

	it('ranks five scripts by points from the number on offer', () => {
		const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() }));
		const vote = {
			...newScriptVote('v', 'ranked', five)!,
			ballots: { alex: ['e', 'd', 'c', 'b', 'a'], bo: ['a', 'e', 'b', 'c', 'd'] }
		};
		expect(tallyScriptVote(vote, ['alex', 'bo']).points).toEqual({ a: 6, b: 5, c: 5, d: 5, e: 9 });
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

	it('counts votes, or points by position for a ranking', () => {
		const ranked = {
			...newScriptVote('v', 'ranked', options)!,
			ballots: {
				alex: ['tb', 'bmr', 'recent:x'],
				bo: ['bmr', 'tb', 'recent:x'],
				gone: ['recent:x', 'tb', 'bmr']
			}
		};
		// Someone who left the room no longer counts.
		const tally = tallyScriptVote(ranked, ['alex', 'bo', 'cy']);
		expect(tally.points).toEqual({ tb: 5, bmr: 5, 'recent:x': 2 });
		expect(tally.voted).toBe(2);
		expect(tally.members).toBe(3);
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
