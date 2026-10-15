import { describe, expect, it } from 'vitest';
import { STANDARD_INFO_TOKENS, infoTokens } from './info-tokens.ts';

describe('info tokens', () => {
	it('has the eight standard cards with unique ids, none tied to a character', () => {
		expect(STANDARD_INFO_TOKENS).toHaveLength(8);
		expect(new Set(STANDARD_INFO_TOKENS.map((t) => t.id)).size).toBe(8);
		// Wiki Glossary: "This is the Demon" is the named example of an info token.
		expect(STANDARD_INFO_TOKENS.map((t) => t.text)).toContain('This is the Demon');
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
