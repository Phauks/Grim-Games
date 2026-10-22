import { describe, expect, it } from 'vitest';
import { TILE_COLOURS, TILE_SYMBOLS, tileLetters, tileMarks, tileRoman } from './tile-face.ts';

const names = (size: number, face: Parameters<typeof tileMarks>[1], seed = 'g') =>
	tileMarks(size, face, seed).map((m) => m.name);

describe('tile marks', () => {
	it('letters run A to Z, then AA, AB', () => {
		expect([1, 2, 26, 27, 28, 52, 53].map(tileLetters)).toEqual([
			'A',
			'B',
			'Z',
			'AA',
			'AB',
			'AZ',
			'BA'
		]);
	});

	it('Roman numerals count up past the tens', () => {
		expect([9, 14, 19, 20, 24, 40, 49].map(tileRoman)).toEqual([
			'IX',
			'XIV',
			'XIX',
			'XX',
			'XXIV',
			'XL',
			'XLIX'
		]);
	});

	it('numbers, letters, symbols and colours in order', () => {
		expect(names(3, 'numbers')).toEqual(['1', '2', '3']);
		expect(names(3, 'letters')).toEqual(['A', 'B', 'C']);
		expect(names(5, 'roman')).toEqual(['I', 'II', 'III', 'IV', 'V']);
		expect(tileMarks(2, 'none', 'g').map((m) => m.kind === 'text' && m.text)).toEqual(['', '']);
		expect(names(2, 'none')).toEqual(['1', '2']);
		expect(names(2, 'symbols')).toEqual(['Star', 'Moon']);
		expect(names(2, 'colours')).toEqual(['Red', 'Orange']);
		expect(names(2, 'emoji')).toEqual(['Apple', 'Banana']);
	});

	it('symbols and colours number their second round, so every tile differs', () => {
		const size = TILE_SYMBOLS.length + 1;
		expect(names(size, 'symbols').at(-1)).toBe('Star 2');
		expect(new Set(names(TILE_COLOURS.length * 2, 'colours')).size).toBe(TILE_COLOURS.length * 2);
	});

	it('Random mixes the kinds, never repeats, and is the same for the same seed', () => {
		const marks = tileMarks(20, 'random', 'game-1');
		expect(new Set(marks.map((m) => `${m.kind}:${m.name}`)).size).toBe(20);
		expect(new Set(marks.map((m) => m.kind)).size).toBeGreaterThan(1);
		expect(names(20, 'random', 'game-1')).toEqual(marks.map((m) => m.name));
		expect(names(20, 'random', 'game-2')).not.toEqual(marks.map((m) => m.name));
	});

	it('Random label order mixes a kind, keeps every tile different, and stays put per seed', () => {
		const numbers = tileMarks(8, 'numbers', 'game-1', true).map((m) => m.name);
		expect([...numbers].sort((a, b) => Number(a) - Number(b))).toEqual(names(8, 'numbers'));
		expect(numbers).not.toEqual(names(8, 'numbers'));
		expect(tileMarks(8, 'numbers', 'game-1', true).map((m) => m.name)).toEqual(numbers);
		// Colours come from the whole list, not only the first eight of the rainbow.
		const seeds = ['a', 'b', 'c', 'd', 'e'];
		const used = new Set(
			seeds.flatMap((seed) => tileMarks(8, 'colours', seed, true).map((m) => m.name))
		);
		expect(used.size).toBeGreaterThan(8);
		const colours = tileMarks(8, 'colours', 'game-1', true).map((m) => m.name);
		expect(new Set(colours).size).toBe(8);
	});
});
