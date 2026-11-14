import { describe, expect, it } from 'vitest';
import {
	GENERIC_GUESSES,
	characterGuesses,
	genericGuess,
	guessesOf,
	parseGuesses,
	toggleGuess,
	travellerGuess,
	travellerTeam,
	type Guesses
} from './grim-guesses.ts';

describe("a player's guesses on their Grim tab", () => {
	it('sets and clears one seat at a time', () => {
		let guesses = toggleGuess({}, 's1', 'empath');
		guesses = toggleGuess(guesses, 's2', 'imp');
		expect(guesses).toEqual({ s1: ['empath'], s2: ['imp'] });
		expect(toggleGuess(guesses, 's2', 'imp')).toEqual({ s1: ['empath'] });
	});

	it('keeps only the newest guesses a room could hold', () => {
		let guesses: Guesses = {};
		for (let i = 0; i < 45; i++) guesses = toggleGuess(guesses, `s${i}`, 'chef');
		expect(Object.keys(guesses)).toHaveLength(40);
		expect(guesses).not.toHaveProperty('s0');
		expect(guesses).toHaveProperty('s44');
	});

	it('reads anything else as no guesses', () => {
		expect(parseGuesses('x')).toEqual({});
		expect(parseGuesses(['chef'])).toEqual({});
		expect(parseGuesses({ s1: 3, s2: '', s3: 'imp', s4: [], s5: ['imp', 'imp', 'spy'] })).toEqual({
			s5: ['imp', 'spy']
		});
	});
});

describe('several guesses on one seat (Trevor, 2026-10-25)', () => {
	it('a new guess goes first, and a seat holds three at most', () => {
		let guesses = toggleGuess({}, 's1', 'chef');
		guesses = toggleGuess(guesses, 's1', 'empath');
		guesses = toggleGuess(guesses, 's1', 'spy');
		expect(guessesOf(guesses, 's1')).toEqual(['spy', 'empath', 'chef']);
		guesses = toggleGuess(guesses, 's1', 'imp');
		expect(guessesOf(guesses, 's1')).toEqual(['imp', 'spy', 'empath']);
	});

	it('tapping a guess again takes it off', () => {
		const guesses = toggleGuess(toggleGuess({}, 's1', 'chef'), 's1', 'spy');
		expect(guessesOf(toggleGuess(guesses, 's1', 'spy'), 's1')).toEqual(['chef']);
		expect(toggleGuess(toggleGuess({}, 's1', 'chef'), 's1', 'chef')).toEqual({});
	});
});

describe('generic guesses (Trevor, 2026-10-24)', () => {
	it('a seat can be any Townsfolk, Outsider, Minion or Demon, or just Good or Evil', () => {
		const guesses = toggleGuess(toggleGuess({}, 's1', 'type:minion'), 's2', 'team:good');
		expect(parseGuesses(guesses)).toEqual({ s1: ['type:minion'], s2: ['team:good'] });
		expect(genericGuess(guesses.s1[0])).toEqual({
			key: 'type:minion',
			type: 'minion',
			team: 'evil'
		});
		expect(genericGuess(guesses.s2[0])).toEqual({ key: 'team:good', team: 'good' });
		expect(genericGuess('imp')).toBeUndefined();
		expect(GENERIC_GUESSES.map((g) => g.key)).toEqual([
			'type:townsfolk',
			'type:outsider',
			'team:good',
			'type:minion',
			'type:demon',
			'team:evil'
		]);
	});
});

describe("a Traveller's seat (Trevor, 2026-10-26)", () => {
	it('is marked Good or Evil only, one at a time', () => {
		let guesses = travellerGuess({}, 's1', 'team:evil');
		expect(guessesOf(guesses, 's1')).toEqual(['team:evil']);
		expect(travellerTeam(guesses, 's1')?.team).toBe('evil');
		guesses = travellerGuess(guesses, 's1', 'team:good');
		expect(guessesOf(guesses, 's1')).toEqual(['team:good']);
		expect(travellerGuess(guesses, 's1', 'team:good')).toEqual({});
	});

	it('ignores a character guess left on the seat', () => {
		const guesses: Guesses = { s1: ['imp', 'type:minion'] };
		expect(travellerTeam(guesses, 's1')).toBeUndefined();
		expect(travellerTeam({ s1: ['imp', 'team:evil'] }, 's1')?.team).toBe('evil');
		expect(travellerGuess(guesses, 's1', 'imp')).toEqual({});
	});
});

describe('the characters a seat is guessed as, for the Notes tab (Trevor, 2026-10-27)', () => {
	it('names every character guessed, newest first, without a type or team', () => {
		let guesses = toggleGuess({}, 's1', 'empath');
		guesses = toggleGuess(guesses, 's1', 'type:minion');
		guesses = toggleGuess(guesses, 's1', 'spy');
		expect(characterGuesses(guesses, 's1')).toEqual(['spy', 'empath']);
		expect(characterGuesses(guesses, 's2')).toEqual([]);
	});
});
