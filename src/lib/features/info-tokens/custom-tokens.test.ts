import { describe, expect, it } from 'vitest';
import { MAX_ASKED_CHARACTERS } from '#lib/core/data/info-tokens.ts';
import { MAX_CHOICES, parseAsks, parseStoredInfoTokens } from './custom-tokens.ts';

describe('stored custom info tokens', () => {
	it('reads version 1, turning its bold (drawn red) into red text', () => {
		const stored = parseStoredInfoTokens({
			version: 1,
			custom: [{ id: 'a', text: 'You are **mad** and *sad*' }]
		});
		expect(stored).toEqual({
			version: 3,
			custom: [{ id: 'a', text: 'You are [red]mad[/red] and *sad*', source: 'custom' }]
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
		expect(parseStoredInfoTokens({ version: 4, custom: [] }).custom).toEqual([]);
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

describe('what a custom card asks for', () => {
	it('moves version 2 "with characters" to 3 characters and "fill in" to text', () => {
		const parsed = parseStoredInfoTokens({
			version: 2,
			custom: [
				{ id: 'a', text: 'You are mad', shows: 'characters', blank: true },
				{ id: 'b', text: 'Hello', shows: 'player' }
			]
		});
		expect(parsed.custom[0].asks).toEqual({ characters: 3, value: { kind: 'text' } });
		expect(parsed.custom[1]).not.toHaveProperty('asks');
		expect(parsed.custom[0]).not.toHaveProperty('blank');
		expect(parsed.custom[0]).not.toHaveProperty('shows');
	});

	it('reads the characters a card belongs to, and older saves without them', () => {
		const parsed = parseStoredInfoTokens({
			version: 1,
			custom: [
				{ id: 'a', text: 'You are mad', characterIds: ['cerenovus', 7, 'cerenovus'] },
				{ id: 'b', text: 'Old card' }
			]
		});
		expect(parsed.custom[0]).toMatchObject({ characterIds: ['cerenovus'] });
		expect(parsed.custom[1]).not.toHaveProperty('characterIds');
	});

	it('keeps each part of version 3 asks on its own', () => {
		const parsed = parseStoredInfoTokens({
			version: 3,
			custom: [
				{ id: 'a', text: 'Pick', asks: { value: { kind: 'choices', options: ['Red', 'Blue'] } } },
				{
					id: 'b',
					text: 'Count',
					asks: { characters: 2, value: { kind: 'number', min: 1, max: 5 } }
				}
			]
		});
		expect(parsed.custom.map((t) => t.asks)).toEqual([
			{ value: { kind: 'choices', options: ['Red', 'Blue'] } },
			{ characters: 2, value: { kind: 'number', min: 1, max: 5 } }
		]);
	});

	it('drops what a card cannot ask for', () => {
		expect(parseAsks({ characters: 0 })).toBeUndefined();
		expect(parseAsks({ characters: 99 })).toEqual({ characters: MAX_ASKED_CHARACTERS });
		expect(
			parseAsks({ value: { kind: 'choices', options: ['Only', ' ', 'Only'] } })
		).toBeUndefined();
		expect(parseAsks({ value: { kind: 'number', min: 5, max: 2 } })).toEqual({
			value: { kind: 'number', min: 5 }
		});
		expect(parseAsks({ value: { kind: 'colour' } })).toBeUndefined();
		const many = Array.from({ length: 20 }, (_, i) => `Answer ${i}`);
		expect(parseAsks({ value: { kind: 'choices', options: many } })?.value).toMatchObject({
			options: many.slice(0, MAX_CHOICES)
		});
	});
});
