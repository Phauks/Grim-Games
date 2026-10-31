import { describe, expect, it } from 'vitest';
import { RULE_MINIMAL_EXAMPLE } from '#lib/core/modes/rule-guide.ts';
import { parseSpecialRule } from '#lib/core/modes/index.ts';
import { modeFileFromHash, modePayloadOf, modeShareLink } from './mode-share.ts';

describe('mode file share links', () => {
	it('carry the whole file in the hash of a New game link', async () => {
		const rule = parseSpecialRule(RULE_MINIMAL_EXAMPLE);
		if (!rule.ok) throw new Error(rule.issues.join());
		const url = await modeShareLink('https://example.com', rule.rule);
		const { pathname, search, hash } = new URL(url);
		expect(pathname).toBe('/new');
		// Nothing in a query string (CLAUDE.md: Worker logs keep query strings).
		expect(search).toBe('');
		const text = await modeFileFromHash(hash);
		expect(JSON.parse(text ?? '')).toEqual(rule.rule);
	});

	it('read nothing from a hash without a mode file', async () => {
		expect(modePayloadOf('#s=1.abc')).toBeUndefined();
		expect(await modeFileFromHash('')).toBeUndefined();
	});

	it('refuse a damaged link', async () => {
		await expect(modeFileFromHash('#m=1.!!!')).rejects.toThrow();
	});
});
