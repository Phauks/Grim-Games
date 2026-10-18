import { describe, expect, it } from 'vitest';
import {
	addCollection,
	deleteCollection,
	emptyCollections,
	parseCollections,
	renameCollection,
	savedIdOf,
	savedRef,
	toggleCharacter
} from './library-collections.ts';

describe('character collections', () => {
	it('adds, renames, fills and deletes a collection', () => {
		let state = addCollection(emptyCollections(), 'c1', '  Our   homebrew ', 1);
		expect(state.collections[0]).toEqual({
			id: 'c1',
			name: 'Our homebrew',
			characters: [],
			updatedAt: 1
		});
		state = renameCollection(state, 'c1', 'Storm set', 2);
		state = toggleCharacter(state, 'c1', 'chef', 3);
		state = toggleCharacter(state, 'c1', savedRef('s1'), 4);
		expect(state.collections[0].characters).toEqual(['chef', 'saved:s1']);
		state = toggleCharacter(state, 'c1', 'chef', 5);
		expect(state.collections[0]).toMatchObject({ name: 'Storm set', characters: ['saved:s1'] });
		expect(deleteCollection(state, 'c1').collections).toEqual([]);
	});

	it('ignores a blank name', () => {
		const state = emptyCollections();
		expect(addCollection(state, 'c1', '   ', 1)).toBe(state);
	});

	it('reads stored collections, dropping junk, and leaves a newer build’s alone', () => {
		expect(
			parseCollections({
				version: 1,
				collections: [
					{ id: 'c1', name: 'A', characters: ['chef', 'chef', 4, ''], updatedAt: 9 },
					{ id: 'c1', name: 'Duplicate', characters: [] },
					{ name: 'No id' }
				]
			})
		).toEqual({
			version: 1,
			collections: [{ id: 'c1', name: 'A', characters: ['chef'], updatedAt: 9 }]
		});
		expect(parseCollections({ version: 2, collections: [] })).toBeUndefined();
		expect(parseCollections('junk')).toEqual(emptyCollections());
	});

	it('tells a Character builder character from an official one', () => {
		expect(savedIdOf(savedRef('s1'))).toBe('s1');
		expect(savedIdOf('chef')).toBeUndefined();
	});
});
