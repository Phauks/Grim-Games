import { describe, expect, it } from 'vitest';
import { editionScript, loadScript } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { filterRows, nextSort, pickerRow, sortRows, type PickerRow } from './picker-rows.ts';

const data = committedGameData();

function custom(name: string, author: string | undefined, ids: string[]) {
	const script = loadScript(
		[{ id: '_meta', name, ...(author ? { author } : {}) }, ...ids],
		data
	).script!;
	return script;
}

const tb = pickerRow(editionScript('tb', data)!, 'tb', 'official');
const small = pickerRow(
	custom('Tiny Town', 'Zed', ['chef', 'empath', 'saint', 'poisoner', 'imp']),
	'tiny',
	'curated',
	'Teensyville'
);
const anon = pickerRow(
	custom('Anon', undefined, ['washerwoman', 'baron', 'imp']),
	'anon',
	'recent'
);
const rows: PickerRow[] = [tb, small, anon];
const ALL = ['official', 'curated', 'recent', 'profile', 'botc'] as const;

describe('pickerRow', () => {
	it('counts Townsfolk, Outsiders, Minions and Demons, and calls small scripts Teensyville', () => {
		expect(tb).toMatchObject({ characters: 22, kind: 'Full', author: 'The Pandemonium Institute' });
		expect(small).toMatchObject({ characters: 5, kind: 'Teensyville', note: 'Teensyville' });
	});
});

describe('filterRows', () => {
	it('searches names, authors and character names, every word', () => {
		expect(filterRows(rows, { term: 'tiny', sources: ALL, kind: '' })).toEqual([small]);
		expect(filterRows(rows, { term: 'zed', sources: ALL, kind: '' })).toEqual([small]);
		expect(filterRows(rows, { term: 'Baron imp', sources: ALL, kind: '' })).toEqual([tb, anon]);
	});

	it('filters by author and characters, the way BotC Scripts does', () => {
		expect(filterRows(rows, { term: '', sources: ALL, kind: '', author: 'ze' })).toEqual([small]);
		expect(filterRows(rows, { term: '', sources: ALL, kind: '', include: ['Baron'] })).toEqual([
			tb,
			anon
		]);
		expect(filterRows(rows, { term: '', sources: ALL, kind: '', exclude: ['baron'] })).toEqual([
			small
		]);
		expect(
			filterRows(rows, { term: '', sources: ALL, kind: '', oneDemon: true }, data).map((r) => r.key)
		).toEqual(['tb', 'tiny', 'anon']);
	});

	it('filters by source and by kind', () => {
		expect(filterRows(rows, { term: '', sources: ['official'], kind: '' })).toEqual([tb]);
		expect(filterRows(rows, { term: '', sources: ALL, kind: 'Full' })).toEqual([tb]);
	});
});

describe('sortRows', () => {
	it('keeps source order without a sort', () => {
		expect(sortRows(rows, undefined)).toEqual(rows);
	});

	it('sorts by a column either way, ties by name', () => {
		expect(sortRows(rows, { column: 'name', descending: false }).map((r) => r.key)).toEqual([
			'anon',
			'tiny',
			'tb'
		]);
		expect(sortRows(rows, { column: 'characters', descending: true }).map((r) => r.key)).toEqual([
			'tb',
			'tiny',
			'anon'
		]);
	});

	it('puts scripts without an author last in both directions', () => {
		for (const descending of [false, true]) {
			expect(sortRows(rows, { column: 'author', descending }).at(-1)).toBe(anon);
		}
	});
});

describe('nextSort', () => {
	it('goes ascending, descending, then off', () => {
		const first = nextSort(undefined, 'name');
		expect(first).toEqual({ column: 'name', descending: false });
		const second = nextSort(first, 'name');
		expect(second).toEqual({ column: 'name', descending: true });
		expect(nextSort(second, 'name')).toBeUndefined();
		expect(nextSort(second, 'author')).toEqual({ column: 'author', descending: false });
	});
});
