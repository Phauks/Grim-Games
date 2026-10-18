import { describe, expect, it } from 'vitest';
import { MAX_ASKED_CHARACTERS, STANDARD_INFO_TOKENS, infoTokens } from './info-tokens.ts';

const byId = (id: string) => STANDARD_INFO_TOKENS.find((t) => t.id === id);

describe('info tokens', () => {
	it('has the eight base cards with unique ids, none tied to a character', () => {
		const base = STANDARD_INFO_TOKENS.filter((t) => !t.extra);
		expect(base).toHaveLength(8);
		expect(new Set(STANDARD_INFO_TOKENS.map((t) => t.id)).size).toBe(STANDARD_INFO_TOKENS.length);
		// Wiki Glossary: "This is the Demon" is the named example of an info token.
		expect(STANDARD_INFO_TOKENS.map((t) => t.text)).toContain('This is the Demon');
	});

	it("marks Trevor's additions as extras, listed after the base cards", () => {
		const extras = STANDARD_INFO_TOKENS.filter((t) => t.extra).map((t) => t.text);
		expect(extras).toEqual([
			'Your number is',
			'Yes/No',
			'True/False',
			'What are you bluffing?',
			'Use your ability?',
			'Please choose again'
		]);
		const firstExtra = STANDARD_INFO_TOKENS.findIndex((t) => t.extra);
		expect(STANDARD_INFO_TOKENS.slice(firstExtra).every((t) => t.extra)).toBe(true);
	});

	it('lets the Storyteller hide standard cards and add custom ones', () => {
		const list = infoTokens(
			[{ id: 'c1', text: 'You are mad', source: 'custom' }],
			['did-you-vote']
		);
		expect(list.map((t) => t.id)).not.toContain('did-you-vote');
		expect(list.at(-1)?.text).toBe('You are mad');
	});

	it('asks for the three bluffs with "not in play", and one character with "You are"', () => {
		// https://wiki.bloodontheclocktower.com/Demon: the Demon learns 3 not-in-play characters.
		expect(byId('not-in-play')?.asks).toEqual({ characters: 3 });
		expect(byId('you-are')?.asks).toEqual({ characters: 1 });
	});

	it('lets "This player is" name several characters, e.g. for the Dreamer', () => {
		// https://wiki.bloodontheclocktower.com/Dreamer: the player learns one good and one evil character.
		expect(byId('this-player-is')?.asks?.characters).toBeGreaterThanOrEqual(2);
	});

	it('asks for a number with "Your number is" and an answer with Yes/No, shown alone', () => {
		expect(byId('number')?.asks?.value).toEqual({ kind: 'number', min: 0 });
		expect(byId('yes-no')?.asks?.value).toEqual({ kind: 'choices', options: ['Yes', 'No'] });
		expect(byId('yes-no')?.answerOnly).toBe(true);
		expect(byId('true-false')?.asks?.value).toEqual({
			kind: 'choices',
			options: ['True', 'False']
		});
		expect(byId('true-false')?.answerOnly).toBe(true);
	});

	it('asks nothing of the cards the Storyteller only points with', () => {
		expect(byId('this-is-the-demon')?.asks).toBeUndefined();
		expect(byId('did-you-vote')?.asks).toBeUndefined();
	});

	it('never asks for more characters than a card may hold', () => {
		for (const token of STANDARD_INFO_TOKENS)
			expect(token.asks?.characters ?? 0).toBeLessThanOrEqual(MAX_ASKED_CHARACTERS);
	});
});
