/**
 * The answers a Storyteller may give a player whose ability doesn't work. Each scenario
 * paraphrases the wiki:
 * - https://wiki.bloodontheclocktower.com/Poisoner: a poisoned player may be given any
 *   information, true or false.
 * - https://wiki.bloodontheclocktower.com/Vortox: Townsfolk information must be false.
 * - https://wiki.bloodontheclocktower.com/Oracle, /Undertaker, /Flowergirl
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { answerOptions, nightAnswer } from './answers.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

function game(cast: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(names.slice(0, cast.length));
	const s = run(
		session,
		ctx,
		...cast.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((f) => f(seats))
	);
	return { game: s.game, seats };
}

const poison = (i: number) => (s: string[]) =>
	({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId: 'poisoner', label: 'Poisoned' }
	}) as const;

function options(cast: string[], seat: number, ...extra: ((seats: string[]) => Command)[]) {
	const { game: g, seats } = game(cast, ...extra);
	const a = nightAnswer(g, seats[seat], cast[seat], characters);
	if (!a) throw new Error(`no night answer for ${cast[seat]}`);
	return answerOptions(g, a, characters);
}

describe('answer options', () => {
	const oracle = ['oracle', 'poisoner', 'imp', 'chef', 'empath'];
	const dead = (i: number) => (s: string[]) =>
		({ type: 'SetDead', seatId: s[i], dead: true }) as const;

	it('offers nothing beyond the truth while the ability works', () => {
		expect(options(oracle, 0, dead(3))).toEqual([]);
	});

	it('a poisoned Oracle may be given any count up to the dead players, the true one first', () => {
		const got = options(oracle, 0, dead(3), dead(4), poison(0));
		expect(got.map((o) => [o.reason, o.value])).toEqual([
			['true', { kind: 'number', value: 0 }],
			['unreliable', { kind: 'number', value: 1 }],
			['unreliable', { kind: 'number', value: 2 }]
		]);
	});

	it('a poisoned Undertaker may be shown any other character on the script', () => {
		const got = options(
			['undertaker', 'poisoner', 'imp', 'chef', 'slayer'],
			0,
			(s) => ({ type: 'Execute', seatId: s[4] }),
			poison(0)
		);
		expect(got[0]).toEqual({ reason: 'true', value: { kind: 'character', value: 'slayer' } });
		expect(got[1].reason).toBe('unreliable');
		expect(got[1].otherCharacters).toContain('imp');
		expect(got[1].otherCharacters).not.toContain('slayer');
	});

	it('a poisoned Flowergirl may hear the other answer', () => {
		const got = options(
			['flowergirl', 'poisoner', 'imp', 'chef', 'slayer'],
			0,
			() => ({ type: 'SetDayMark', mark: 'demon-voted', value: true }),
			poison(0)
		);
		expect(got.map((o) => [o.reason, o.value])).toEqual([
			['true', { kind: 'yes-no', value: true }],
			['unreliable', { kind: 'yes-no', value: false }]
		]);
	});

	it('under the Vortox the true answer is not valid and only false ones are offered', () => {
		const got = options(['flowergirl', 'vortox', 'chef', 'slayer', 'empath'], 0, () => ({
			type: 'SetDayMark',
			mark: 'demon-voted',
			value: false
		}));
		expect(got.map((o) => [o.reason, o.value])).toEqual([
			['invalid', { kind: 'yes-no', value: false }],
			['vortox', { kind: 'yes-no', value: true }]
		]);
	});

	it('offers nothing when there is nothing to give', () => {
		expect(options(['undertaker', 'poisoner', 'imp', 'chef', 'slayer'], 0, poison(0))).toEqual([]);
	});
});
