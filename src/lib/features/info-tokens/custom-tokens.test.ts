import { describe, expect, it } from 'vitest';
import { parseStoredInfoTokens } from './custom-tokens.ts';

describe('stored custom info tokens', () => {
	it('reads version 1, turning its bold (drawn red) into red text', () => {
		const stored = parseStoredInfoTokens({
			version: 1,
			custom: [{ id: 'a', text: 'You are **mad** and *sad*' }]
		});
		expect(stored).toEqual({
			version: 2,
			custom: [
				{ id: 'a', text: 'You are [red]mad[/red] and *sad*', source: 'custom', shows: 'none' }
			]
		});
	});

	it('reads version 2 as stored, bold staying bold', () => {
		const stored = parseStoredInfoTokens({
			version: 2,
			custom: [{ id: 'a', text: '**You** are [blue]mad[/blue]' }]
		});
		expect(stored.custom[0].text).toBe('**You** are [blue]mad[/blue]');
	});

	it('falls back to empty for unknown versions or junk', () => {
		expect(parseStoredInfoTokens(null).custom).toEqual([]);
		expect(parseStoredInfoTokens({ version: 3, custom: [] }).custom).toEqual([]);
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

describe('custom cards with characters', () => {
	it('keeps a card that asks for characters, and treats anything else as none', () => {
		const parsed = parseStoredInfoTokens({
			version: 1,
			custom: [
				{ id: 'a', text: 'You are **mad** that you are', shows: 'characters' },
				{ id: 'b', text: 'Hello', shows: 'player' }
			]
		});
		expect(parsed.custom.map((t) => t.shows)).toEqual(['characters', 'none']);
	});

	it('reads the characters a card belongs to and its fill-in, and older saves without them', () => {
		const parsed = parseStoredInfoTokens({
			version: 1,
			custom: [
				{ id: 'a', text: 'You are mad', characterIds: ['cerenovus', 7, 'cerenovus'], blank: true },
				{ id: 'b', text: 'Old card' }
			]
		});
		expect(parsed.custom[0]).toMatchObject({ characterIds: ['cerenovus'], blank: true });
		expect(parsed.custom[1]).not.toHaveProperty('characterIds');
		expect(parsed.custom[1]).not.toHaveProperty('blank');
	});
});
