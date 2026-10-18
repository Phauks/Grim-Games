import { describe, expect, it } from 'vitest';
import { emptyLabels, type LibraryLabels } from './library-labels.ts';
import {
	characterKey,
	collectionKey,
	folderSize,
	isBrowsing,
	itemsShown,
	type LibraryItem
} from './library-items.ts';

const items: LibraryItem[] = [
	{ key: 'json:a', kind: 'script', name: 'Catfishing', haystack: 'catfishing' },
	{ key: characterKey('s1'), kind: 'character', name: 'Stormwarden', haystack: 'stormwarden' },
	{ key: collectionKey('c1'), kind: 'collection', name: 'Our homebrew', haystack: 'our homebrew' },
	{ key: 'json:b', kind: 'script', name: 'Teensy storm', haystack: 'teensy storm' }
];

const state: LibraryLabels = {
	...emptyLabels(),
	tags: [{ id: 'fav', name: 'Favourites' }],
	folders: [
		{ id: 'home', name: 'Home games' },
		{ id: 'teensy', name: 'Teensy', parent: 'home' }
	],
	scripts: {
		'json:a': { tags: ['fav'], folder: 'home' },
		[characterKey('s1')]: { tags: [], folder: 'home' },
		'json:b': { tags: ['fav'], folder: 'teensy' }
	}
};

const browse = { folder: undefined, kind: 'all', tags: [], term: '' } as const;

describe('itemsShown', () => {
	it('lists only what sits directly in the open folder while browsing', () => {
		expect(itemsShown(items, state, browse).map((i) => i.name)).toEqual(['Our homebrew']);
		expect(itemsShown(items, state, { ...browse, folder: 'home' }).map((i) => i.name)).toEqual([
			'Catfishing',
			'Stormwarden'
		]);
	});

	it('lists one kind from the folder and every folder inside it', () => {
		const filter = { ...browse, folder: 'home', kind: 'script' } as const;
		expect(isBrowsing(filter)).toBe(false);
		expect(itemsShown(items, state, filter).map((i) => i.name)).toEqual([
			'Catfishing',
			'Teensy storm'
		]);
	});

	it('searches and filters by tag across folders', () => {
		expect(itemsShown(items, state, { ...browse, term: 'STORM' }).map((i) => i.name)).toEqual([
			'Stormwarden',
			'Teensy storm'
		]);
		expect(itemsShown(items, state, { ...browse, tags: ['fav'] }).map((i) => i.name)).toEqual([
			'Catfishing',
			'Teensy storm'
		]);
	});
});

describe('folderSize', () => {
	it('counts the folders and items directly inside', () => {
		expect(folderSize(items, state, 'home')).toBe(3);
		expect(folderSize(items, state, 'teensy')).toBe(1);
	});
});
