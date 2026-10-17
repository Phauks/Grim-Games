import { describe, expect, it } from 'vitest';
import {
	addLabel,
	deleteLabel,
	emptyLabels,
	filterLibrary,
	labelsFor,
	labelUses,
	libraryKey,
	parseLabels,
	renameLabel,
	setFolder,
	toggleTag,
	type LibraryLabels
} from './library-labels.ts';

function sample(): LibraryLabels {
	let s = emptyLabels();
	s = addLabel(s, 'tags', 'Favorite', 't1');
	s = addLabel(s, 'tags', 'Wanna try', 't2');
	s = addLabel(s, 'folders', 'Club night', 'f1');
	return s;
}

describe('libraryKey', () => {
	it('gives the same key for the same script and different keys otherwise', () => {
		const a = libraryKey({ json: [{ id: '_meta', name: 'A' }, 'washerwoman'] });
		const b = libraryKey({ json: [{ id: '_meta', name: 'A' }, 'washerwoman'] });
		const c = libraryKey({ json: [{ id: '_meta', name: 'A' }, 'librarian'] });
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	it('keys an official edition by its id', () => {
		expect(libraryKey({ edition: 'tb', json: [] })).toBe('edition:tb');
	});
});

describe('labels', () => {
	it('adds trimmed names and refuses blank or taken ones, ignoring case', () => {
		let s = addLabel(emptyLabels(), 'tags', '  Stupid   fun ', 'a');
		expect(s.tags).toEqual([{ id: 'a', name: 'Stupid fun' }]);
		expect(addLabel(s, 'tags', 'stupid FUN', 'b')).toBe(s);
		expect(addLabel(s, 'tags', '   ', 'c')).toBe(s);
		s = addLabel(s, 'folders', 'Stupid fun', 'f');
		expect(s.folders).toHaveLength(1);
	});

	it('renames, keeping the name free', () => {
		const s = sample();
		expect(renameLabel(s, 'tags', 't1', 'Favourite').tags[0].name).toBe('Favourite');
		expect(renameLabel(s, 'tags', 't1', 'wanna try')).toBe(s);
		// Its own name in another case is fine.
		expect(renameLabel(s, 'tags', 't1', 'FAVORITE').tags[0].name).toBe('FAVORITE');
	});

	it('puts a script in one folder at most and toggles tags', () => {
		let s = sample();
		s = setFolder(s, 'k', 'f1');
		s = toggleTag(s, 'k', 't1');
		s = toggleTag(s, 'k', 't2');
		expect(labelsFor(s, 'k')).toEqual({ folder: 'f1', tags: ['t1', 't2'] });
		s = toggleTag(s, 'k', 't1');
		expect(labelsFor(s, 'k').tags).toEqual(['t2']);
		s = setFolder(s, 'k', undefined);
		s = toggleTag(s, 'k', 't2');
		expect(s.scripts).toEqual({});
	});

	it('ignores unknown folders and tags', () => {
		const s = sample();
		expect(setFolder(s, 'k', 'nope')).toBe(s);
		expect(toggleTag(s, 'k', 'nope')).toBe(s);
	});

	it('deleting a label takes it off its scripts, which stay', () => {
		let s = sample();
		s = toggleTag(setFolder(s, 'k', 'f1'), 'k', 't1');
		s = toggleTag(s, 'j', 't1');
		expect(labelUses(s, 'tags', 't1')).toBe(2);
		s = deleteLabel(s, 'tags', 't1');
		expect(s.tags.map((t) => t.id)).toEqual(['t2']);
		expect(s.scripts).toEqual({ k: { tags: [], folder: 'f1' } });
		s = deleteLabel(s, 'folders', 'f1');
		expect(s.scripts).toEqual({});
	});
});

describe('parseLabels', () => {
	it('round-trips stored data and starts empty on junk', () => {
		const s = toggleTag(sample(), 'k', 't1');
		expect(parseLabels(JSON.parse(JSON.stringify(s)))).toEqual(s);
		expect(parseLabels(null)).toEqual(emptyLabels());
		expect(parseLabels({ version: 1, tags: 'x', scripts: [] })).toEqual(emptyLabels());
	});

	it('drops references to labels that no longer exist', () => {
		const parsed = parseLabels({
			version: 1,
			tags: [{ id: 't1', name: 'A' }],
			folders: [],
			scripts: { k: { tags: ['t1', 'gone'], folder: 'gone' }, j: { tags: ['gone'] } }
		});
		expect(parsed?.scripts).toEqual({ k: { tags: ['t1'] } });
	});

	it('leaves data from a newer build alone', () => {
		expect(parseLabels({ version: 2 })).toBeUndefined();
	});
});

describe('filterLibrary', () => {
	const rows = [
		{ key: 'a', haystack: 'trouble brewing\nwasherwoman' },
		{ key: 'b', haystack: 'my script\nimp' },
		{ key: 'c', haystack: 'other\nimp' }
	];
	let s = sample();
	s = toggleTag(toggleTag(setFolder(s, 'a', 'f1'), 'a', 't1'), 'a', 't2');
	s = toggleTag(s, 'b', 't1');
	const keys = (filter: Parameters<typeof filterLibrary>[2]) =>
		filterLibrary(rows, s, filter).map((r) => r.key);

	it('filters by search, folder and every chosen tag', () => {
		expect(keys({ term: ' IMP ', folder: { kind: 'all' }, tags: [] })).toEqual(['b', 'c']);
		expect(keys({ term: '', folder: { kind: 'folder', id: 'f1' }, tags: [] })).toEqual(['a']);
		expect(keys({ term: '', folder: { kind: 'none' }, tags: [] })).toEqual(['b', 'c']);
		expect(keys({ term: '', folder: { kind: 'all' }, tags: ['t1'] })).toEqual(['a', 'b']);
		expect(keys({ term: '', folder: { kind: 'all' }, tags: ['t1', 't2'] })).toEqual(['a']);
	});
});
