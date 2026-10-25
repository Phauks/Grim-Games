import { describe, expect, it } from 'vitest';
import { GENERIC_GUESSES, genericGuess, parseGuesses, withGuess } from './grim-guesses.ts';

describe("a player's guesses on their Grim tab", () => {
	it('sets, replaces and clears one seat at a time', () => {
		let guesses = withGuess({}, 's1', 'empath');
		guesses = withGuess(guesses, 's2', 'imp');
		guesses = withGuess(guesses, 's1', 'chef');
		expect(guesses).toEqual({ s1: 'chef', s2: 'imp' });
		expect(withGuess(guesses, 's2')).toEqual({ s1: 'chef' });
	});

	it('keeps only the newest guesses a room could hold', () => {
		let guesses = {};
		for (let i = 0; i < 45; i++) guesses = withGuess(guesses, `s${i}`, 'chef');
		expect(Object.keys(guesses)).toHaveLength(40);
		expect(guesses).not.toHaveProperty('s0');
		expect(guesses).toHaveProperty('s44');
	});

	it('reads anything else as no guesses', () => {
		expect(parseGuesses('x')).toEqual({});
		expect(parseGuesses(['chef'])).toEqual({});
		expect(parseGuesses({ s1: 3, s2: '', s3: 'imp' })).toEqual({ s3: 'imp' });
	});
});

describe('generic guesses (Trevor, 2026-10-24)', () => {
	it('a seat can be any Townsfolk, Outsider, Minion or Demon, or just Good or Evil', () => {
		const guesses = withGuess(withGuess({}, 's1', 'type:minion'), 's2', 'team:good');
		expect(parseGuesses(guesses)).toEqual({ s1: 'type:minion', s2: 'team:good' });
		expect(genericGuess(guesses.s1)).toEqual({ key: 'type:minion', type: 'minion', team: 'evil' });
		expect(genericGuess(guesses.s2)).toEqual({ key: 'team:good', team: 'good' });
		expect(genericGuess('imp')).toBeUndefined();
		expect(GENERIC_GUESSES.map((g) => g.key)).toEqual([
			'type:townsfolk',
			'type:outsider',
			'type:minion',
			'type:demon',
			'team:good',
			'team:evil'
		]);
	});
});
