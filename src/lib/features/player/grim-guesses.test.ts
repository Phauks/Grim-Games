import { describe, expect, it } from 'vitest';
import {
	GENERIC_GUESSES,
	clearGuesses,
	cycleGuess,
	genericGuess,
	guessesOf,
	mainGuess,
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
		expect(clearGuesses(guesses, 's2')).toEqual({ s1: ['empath'] });
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
		expect(parseGuesses({ s1: 3, s2: '', s3: 'imp', s4: [] })).toEqual({ s3: ['imp'] });
	});

	it('reads a guess saved before seats held several as a list of one', () => {
		expect(parseGuesses({ s1: 'chef', s2: ['imp', 'imp', 'spy'] })).toEqual({
			s1: ['chef'],
			s2: ['imp', 'spy']
		});
	});
});

describe('several guesses on one seat (Trevor, 2026-10-25)', () => {
	it('a new guess becomes the main one, and a seat holds three at most', () => {
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

	it('the arrow cycles the main guess, and any guess can be made the main one', () => {
		let guesses: Guesses = { s1: ['chef', 'spy', 'imp'] };
		guesses = cycleGuess(guesses, 's1');
		expect(guessesOf(guesses, 's1')).toEqual(['spy', 'imp', 'chef']);
		guesses = mainGuess(guesses, 's1', 'chef');
		expect(guessesOf(guesses, 's1')).toEqual(['chef', 'spy', 'imp']);
		expect(mainGuess(guesses, 's1', 'empath')).toBe(guesses);
		expect(cycleGuess({}, 's1')).toEqual({});
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
			'type:minion',
			'type:demon',
			'team:good',
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
