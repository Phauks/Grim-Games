import { describe, expect, it } from 'vitest';
import { matchesText, nextSort, sortRows } from './stat-rows.ts';

const rows = [
	{ name: 'Chef', rate: 0.5 },
	{ name: 'Imp', rate: undefined },
	{ name: 'Baron', rate: 0.75 }
];
const value = (row: (typeof rows)[number], column: 'name' | 'rate') => row[column];

describe('sortRows', () => {
	it('keeps the given order with no sort', () => {
		expect(sortRows(rows, undefined, value)).toEqual(rows);
	});

	it('sorts names and numbers, rows with no value last either way', () => {
		const names = (sorted: typeof rows) => sorted.map((r) => r.name);
		expect(names(sortRows(rows, { column: 'name', direction: 'ascending' }, value))).toEqual([
			'Baron',
			'Chef',
			'Imp'
		]);
		expect(names(sortRows(rows, { column: 'rate', direction: 'descending' }, value))).toEqual([
			'Baron',
			'Chef',
			'Imp'
		]);
		expect(names(sortRows(rows, { column: 'rate', direction: 'ascending' }, value))).toEqual([
			'Chef',
			'Baron',
			'Imp'
		]);
	});
});

describe('nextSort', () => {
	it('starts names A to Z and counts highest first, then reverses', () => {
		expect(nextSort(undefined, 'name', ['name'])).toEqual({
			column: 'name',
			direction: 'ascending'
		});
		expect(nextSort(undefined, 'games', ['name'])).toEqual({
			column: 'games',
			direction: 'descending'
		});
		expect(nextSort({ column: 'games', direction: 'descending' }, 'games', ['name'])).toEqual({
			column: 'games',
			direction: 'ascending'
		});
	});
});

describe('matchesText', () => {
	it('matches part of a name, ignoring case', () => {
		expect(matchesText('Trouble Brewing', ' brew ')).toBe(true);
		expect(matchesText('Trouble Brewing', 'violets')).toBe(false);
		expect(matchesText(undefined, '')).toBe(true);
	});
});
