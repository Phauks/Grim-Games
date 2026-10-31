import { describe, expect, it } from 'vitest';
import {
	TILE_COLOURS,
	TILE_RUNES,
	TILE_SYMBOLS,
	tileKanji,
	tileLetters,
	tileMarks,
	tileRoman,
	tileRunes
} from './tile-face.ts';

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

	// Kanji numerals (Trevor, 2026-10-31): digit before 十 for the tens, none before a lone ten.
	it('kanji numerals count up to the 40 seats of several towns, and past', () => {
		expect([1, 2, 9, 10, 11, 19, 20, 21, 30, 40, 99, 100, 111].map(tileKanji)).toEqual([
			'一',
			'二',
			'九',
			'十',
			'十一',
			'十九',
			'二十',
			'二十一',
			'三十',
			'四十',
			'九十九',
			'百',
			'百十一'
		]);
		expect(new Set(names(40, 'kanji')).size).toBe(40);
	});

	// Norse runes (Trevor, 2026-10-31): the 24 Elder Futhark runes, then pairs like the letters.
	it('runes run through the futhark, then pair up so 40 seats all differ', () => {
		expect(TILE_RUNES).toHaveLength(24);
		expect([1, 2, 24, 25, 26, 48, 49].map((n) => tileRunes(n).join(''))).toEqual([
			'ᚠ',
			'ᚢ',
			'ᛟ',
			'ᚠᚠ',
			'ᚠᚢ',
			'ᚠᛟ',
			'ᚢᚠ'
		]);
		expect(names(2, 'runes')).toEqual(['Fehu', 'Uruz']);
		expect(names(26, 'runes').slice(-2)).toEqual(['Fehu Fehu', 'Fehu Uruz']);
		expect(new Set(names(40, 'runes')).size).toBe(40);
	});

	it('numbers, letters, symbols and colours in order', () => {
		expect(names(3, 'numbers')).toEqual(['1', '2', '3']);
		expect(names(3, 'letters')).toEqual(['A', 'B', 'C']);
		expect(names(5, 'roman')).toEqual(['I', 'II', 'III', 'IV', 'V']);
		expect(names(3, 'kanji')).toEqual(['一', '二', '三']);
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

	it('Random draws from every kind, Roman, kanji and runes too, and never shows a mark twice', () => {
		const shown = Array.from({ length: 30 }, (_, i) => tileMarks(40, 'random', `g${i}`)).flat();
		const texts = shown.flatMap((m) => (m.kind === 'text' ? [m.text] : []));
		expect(texts.some((t) => /^[一二三四五六七八九十]+$/.test(t))).toBe(true);
		expect(texts.some((t) => /^[\u16A0-\u16FF]+$/.test(t))).toBe(true);
		expect(texts.some((t) => /^[IVXL]{2,}$/.test(t))).toBe(true);
		for (let i = 0; i < 30; i++) {
			const one = tileMarks(40, 'random', `g${i}`).filter((m) => m.kind === 'text');
			const t = one.map((m) => (m.kind === 'text' ? m.text : ''));
			expect(new Set(t).size).toBe(t.length);
		}
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
