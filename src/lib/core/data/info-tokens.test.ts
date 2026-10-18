import { describe, expect, it } from 'vitest';
import { STANDARD_INFO_TOKENS, infoTokens } from './info-tokens.ts';

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
			'Number',
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
});
