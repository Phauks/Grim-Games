import { describe, expect, it } from 'vitest';
import {
	applyFilters,
	filterKindOf,
	isActive,
	matchesFilter,
	pickOptions,
	readBound
} from './column-filter.ts';

describe('filterKindOf', () => {
	it('lists a few values to tick', () => {
		expect(filterKindOf(['Teensy', 'Full', 'Full', ''])).toBe('pick');
		expect(filterKindOf([1, 2, 3])).toBe('pick');
		expect(filterKindOf([['a', 'b'], ['c'], []])).toBe('pick');
	});

	it('gives many numbers a range and many words a search', () => {
		const numbers = Array.from({ length: 40 }, (_, i) => i);
		expect(filterKindOf([...numbers, undefined])).toBe('range');
		expect(filterKindOf(numbers.map((n) => `Script ${n}`))).toBe('text');
	});
});

describe('pickOptions', () => {
	it('puts None first, then words in reading order and numbers in number order', () => {
		expect(pickOptions(['b', '', 'a', 'b'])).toEqual(['', 'a', 'b']);
		expect(pickOptions([10, 9, null])).toEqual(['', '9', '10']);
		expect(pickOptions([['x', 'y'], ['y'], []])).toEqual(['', 'x', 'y']);
	});
});

describe('matchesFilter', () => {
	it('searches inside words, ignoring case', () => {
		expect(matchesFilter('Fall of Rome', { kind: 'text', text: 'ROME' })).toBe(true);
		expect(matchesFilter(['Fall', 'Rome'], { kind: 'text', text: 'om' })).toBe(true);
		expect(matchesFilter(undefined, { kind: 'text', text: 'x' })).toBe(false);
	});

	it('keeps a ticked value, and None for an empty one', () => {
		expect(matchesFilter('Full', { kind: 'pick', values: ['Full'] })).toBe(true);
		expect(matchesFilter('', { kind: 'pick', values: [''] })).toBe(true);
		expect(matchesFilter([], { kind: 'pick', values: [''] })).toBe(true);
		expect(matchesFilter(['a', 'b'], { kind: 'pick', values: ['b'] })).toBe(true);
		expect(matchesFilter(3, { kind: 'pick', values: ['3'] })).toBe(true);
		expect(matchesFilter('Teensy', { kind: 'pick', values: ['Full'] })).toBe(false);
	});

	it('keeps numbers between the bounds, either of which may be open', () => {
		expect(matchesFilter(5, { kind: 'range', min: 5, max: 9 })).toBe(true);
		expect(matchesFilter(10, { kind: 'range', max: 9 })).toBe(false);
		expect(matchesFilter(undefined, { kind: 'range', min: 0 })).toBe(false);
	});
});

describe('applyFilters', () => {
	const rows = [
		{ name: 'A', likes: 3 },
		{ name: 'B', likes: 30 }
	];
	const value = (row: (typeof rows)[number], column: string) =>
		column === 'likes' ? row.likes : row.name;

	it('keeps rows every set filter keeps and ignores empty ones', () => {
		expect(applyFilters(rows, { likes: { kind: 'range', min: 10 } }, value)).toEqual([rows[1]]);
		expect(applyFilters(rows, { name: { kind: 'text', text: ' ' } }, value)).toBe(rows);
	});
});

describe('isActive and readBound', () => {
	it('treats blank filters as none', () => {
		expect(isActive({ kind: 'pick', values: [] })).toBe(false);
		expect(isActive({ kind: 'range' })).toBe(false);
		expect(isActive({ kind: 'range', min: 0 })).toBe(true);
	});

	it('reads typed bounds', () => {
		expect(readBound(' 12 ')).toBe(12);
		expect(readBound('')).toBeUndefined();
		expect(readBound('abc')).toBeUndefined();
	});
});
