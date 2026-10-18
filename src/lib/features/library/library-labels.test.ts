import { describe, expect, it } from 'vitest';
import {
	addLabel,
	deleteLabel,
	emptyLabels,
	childFolders,
	filterLibrary,
	folderPath,
	folderTree,
	labelsFor,
	labelUses,
	libraryKey,
	moveFolder,
	parseLabels,
	renameLabel,
	setFolder,
	moveLabels,
	setName,
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

	it('renames an item in the Library and keeps it through other changes', () => {
		let s = setName(sample(), 'k', '  Club   night  ');
		s = setFolder(s, 'k', 'f1');
		s = toggleTag(s, 'k', 't1');
		expect(labelsFor(s, 'k')).toEqual({ name: 'Club night', folder: 'f1', tags: ['t1'] });
		expect(parseLabels(JSON.parse(JSON.stringify(s)))?.scripts.k.name).toBe('Club night');
		s = setName(setFolder(toggleTag(s, 'k', 't1'), 'k', undefined), 'k', ' ');
		expect(s.scripts).toEqual({});
	});

	it('moves an item’s folder and tags to the item it became', () => {
		const s = moveLabels(toggleTag(setFolder(sample(), 'a', 'f1'), 'a', 't1'), 'a', 'b');
		expect(labelsFor(s, 'b')).toEqual({ folder: 'f1', tags: ['t1'] });
		expect(s.scripts.a).toBeUndefined();
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
		expect(parseLabels({ version: 3 })).toBeUndefined();
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

describe('nested folders', () => {
	function tree(): LibraryLabels {
		let s = emptyLabels();
		s = addLabel(s, 'folders', 'Club', 'club');
		s = addLabel(s, 'folders', 'Teensy', 'teensy', 'club');
		s = addLabel(s, 'folders', 'Done', 'done', 'teensy');
		s = setFolder(s, 'k1', 'teensy');
		s = setFolder(s, 'k2', 'done');
		return s;
	}

	it('reads version 1 folders as top-level folders', () => {
		const v1 = {
			version: 1,
			tags: [],
			folders: [{ id: 'f', name: 'Old' }],
			scripts: { k: { tags: [], folder: 'f' } }
		};
		const s = parseLabels(v1)!;
		expect(s.version).toBe(2);
		expect(s.folders).toEqual([{ id: 'f', name: 'Old' }]);
		expect(labelsFor(s, 'k').folder).toBe('f');
	});

	it('drops a parent that is missing or loops', () => {
		const s = parseLabels({
			version: 2,
			tags: [],
			folders: [
				{ id: 'a', name: 'A', parent: 'b' },
				{ id: 'b', name: 'B', parent: 'a' },
				{ id: 'c', name: 'C', parent: 'gone' }
			],
			scripts: {}
		})!;
		expect(s.folders.every((f) => f.parent === undefined)).toBe(true);
	});

	it('only needs names unique among a folder’s siblings', () => {
		let s = tree();
		s = addLabel(s, 'folders', 'teensy', 'dup', 'club');
		expect(s.folders.some((f) => f.id === 'dup')).toBe(false);
		s = addLabel(s, 'folders', 'Teensy', 'top');
		expect(s.folders.find((f) => f.id === 'top')?.parent).toBeUndefined();
	});

	it('lists children, the path and the whole tree', () => {
		const s = tree();
		expect(childFolders(s, undefined).map((f) => f.id)).toEqual(['club']);
		expect(childFolders(s, 'club').map((f) => f.id)).toEqual(['teensy']);
		expect(folderPath(s, 'done').map((f) => f.name)).toEqual(['Club', 'Teensy', 'Done']);
		expect(folderTree(s).map(({ folder, depth }) => `${depth}${folder.name}`)).toEqual([
			'0Club',
			'1Teensy',
			'2Done'
		]);
	});

	it('moves a folder, but never into itself or a folder inside it', () => {
		let s = tree();
		expect(moveFolder(s, 'club', 'done')).toBe(s);
		expect(moveFolder(s, 'club', 'club')).toBe(s);
		s = moveFolder(s, 'done', undefined);
		expect(folderPath(s, 'done').map((f) => f.name)).toEqual(['Done']);
	});

	it('deleting a folder moves its scripts and folders up one level', () => {
		const s = deleteLabel(tree(), 'folders', 'teensy');
		expect(labelsFor(s, 'k1').folder).toBe('club');
		expect(s.folders.find((f) => f.id === 'done')?.parent).toBe('club');
		const top = deleteLabel(s, 'folders', 'club');
		expect(labelsFor(top, 'k1').folder).toBeUndefined();
		expect(top.folders.find((f) => f.id === 'done')?.parent).toBeUndefined();
	});

	it('filtering by a folder includes the folders inside it', () => {
		const rows = [
			{ key: 'k1', haystack: 'a' },
			{ key: 'k2', haystack: 'b' },
			{ key: 'k3', haystack: 'c' }
		];
		const keys = (id: string) =>
			filterLibrary(rows, tree(), { term: '', folder: { kind: 'folder', id }, tags: [] }).map(
				(r) => r.key
			);
		expect(keys('club')).toEqual(['k1', 'k2']);
		expect(keys('done')).toEqual(['k2']);
	});
});
