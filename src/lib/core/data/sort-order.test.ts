/**
 * TPI's Sort Order: https://bloodontheclocktower.com/blogs/news/sort-order-sao-update
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	SORT_ORDER_PHRASES,
	compareSortOrder,
	sortByStandardOrder,
	sortOrderRank
} from './sort-order.ts';

const data = committedGameData();
const ids = (...list: string[]) =>
	sortByStandardOrder(list.map((id) => data.byId.get(id)!)).map((c) => c.id);

describe('sortOrderRank', () => {
	it('takes the longest phrase an ability starts with', () => {
		expect(sortOrderRank('Each night*, choose a player')).toBe(
			SORT_ORDER_PHRASES.indexOf('Each night*')
		);
		expect(sortOrderRank('Each night, choose a player')).toBe(
			SORT_ORDER_PHRASES.indexOf('Each night')
		);
		expect(sortOrderRank('If you are “mad” about something')).toBe(
			SORT_ORDER_PHRASES.indexOf('If you are "mad"')
		);
		expect(sortOrderRank('If the Demon dies, something')).toBe(
			SORT_ORDER_PHRASES.indexOf('If the Demon dies')
		);
	});

	it('matches whole words only, and ranks the rest last', () => {
		expect(sortOrderRank('Your neighbours are something')).toBe(SORT_ORDER_PHRASES.length);
		expect(sortOrderRank('Nominees die.')).toBe(SORT_ORDER_PHRASES.length);
	});
});

describe('compareSortOrder', () => {
	it('puts Townsfolk, Outsiders, Minions and Demons in that order', () => {
		expect(ids('imp', 'baron', 'butler', 'chef')).toEqual(['chef', 'butler', 'baron', 'imp']);
	});

	it('orders by opening phrase before length', () => {
		// "You start knowing" (Washerwoman) comes before "Each night" (Empath).
		expect(ids('empath', 'washerwoman')).toEqual(['washerwoman', 'empath']);
		// "Each night" (Empath) before "Each night*" (Monk).
		expect(ids('monk', 'empath')).toEqual(['empath', 'monk']);
	});

	// The article's example: the Monk and the Gambler have equally long abilities, so the
	// shorter name comes first.
	it('breaks equal lengths by name length, then alphabetically', () => {
		const monk = data.byId.get('monk')!;
		const gambler = data.byId.get('gambler')!;
		expect(monk.ability.length).toBe(gambler.ability.length);
		expect(sortOrderRank(monk.ability)).toBe(sortOrderRank(gambler.ability));
		expect(ids('gambler', 'monk')).toEqual(['monk', 'gambler']);
		const same = { type: 'townsfolk' as const, ability: 'You x.' };
		expect(compareSortOrder({ ...same, name: 'Bbb' }, { ...same, name: 'Aaa' })).toBeGreaterThan(0);
	});

	it('sorts every official character without error, by type first', () => {
		const sorted = sortByStandardOrder(data.characters);
		expect(sorted).toHaveLength(data.characters.length);
		const types = sorted.map((c) => c.type);
		expect(types.indexOf('outsider')).toBeGreaterThan(types.lastIndexOf('townsfolk'));
	});
});
