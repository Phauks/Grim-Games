import { describe, expect, it } from 'vitest';
import { parseStoredInfoTokens } from './custom-tokens.ts';

describe('stored custom info tokens', () => {
	it('reads version 1', () => {
		const stored = parseStoredInfoTokens({
			version: 1,
			custom: [{ id: 'a', text: 'You are **mad**' }]
		});
		expect(stored.custom).toEqual([
			{ id: 'a', text: 'You are **mad**', source: 'custom', shows: 'none' }
		]);
	});

	it('falls back to empty for unknown versions or junk', () => {
		expect(parseStoredInfoTokens(null).custom).toEqual([]);
		expect(parseStoredInfoTokens({ version: 2, custom: [] }).custom).toEqual([]);
		expect(parseStoredInfoTokens('nope').custom).toEqual([]);
	});

	it('drops blank, malformed and duplicate entries', () => {
		const stored = parseStoredInfoTokens({
			version: 1,
			custom: [
				{ id: 'a', text: ' ' },
				{ id: 1, text: 'x' },
				{ id: 'b', text: 'B' },
				{ id: 'b', text: 'C' },
				null
			]
		});
		expect(stored.custom.map((t) => t.text)).toEqual(['B']);
	});
});
