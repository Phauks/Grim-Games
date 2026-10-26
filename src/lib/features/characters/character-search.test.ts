import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	foldForSearch,
	matchesReminderSearch,
	matchesSearch,
	searchGroups
} from './character-search.ts';

const data = committedGameData();
const get = (id: string) => data.byId.get(id)!;

describe('character search', () => {
	it('ignores case and accents', () => {
		expect(foldForSearch('Fée ÉLAN')).toBe('fee elan');
		expect(matchesSearch(get('imp'), 'IMP')).toBe(true);
	});

	it('matches the name or the ability text, every word', () => {
		expect(matchesSearch(get('chef'), 'pairs evil')).toBe(true);
		expect(matchesSearch(get('chef'), 'pairs demon')).toBe(false);
		expect(matchesSearch(get('chef'), '')).toBe(true);
	});

	it('groups matches by type in game order and applies the filter', () => {
		const chars = ['imp', 'chef', 'poisoner', 'saint', 'empath'].map(get);
		expect(searchGroups(chars, '').map((g) => g.type)).toEqual([
			'townsfolk',
			'outsider',
			'minion',
			'demon'
		]);
		const groups = searchGroups(chars, '', (c) => c.type !== 'demon');
		expect(groups.flatMap((g) => g.characters.map((c) => c.id))).toEqual([
			'chef',
			'empath',
			'saint',
			'poisoner'
		]);
	});

	it('lists name matches before ability-text matches', () => {
		const chars = ['chef', 'empath', 'washerwoman'].map(get);
		// "em" is in the Empath's name and in other abilities ("them").
		const ids = searchGroups(chars, 'em')[0].characters.map((c) => c.id);
		expect(ids[0]).toBe('empath');
	});
});

describe('reminder search', () => {
	const sailor = { character: get('sailor'), labels: ['Drunk'] };
	it("matches a character's name or its tokens' words, whatever the case", () => {
		expect(matchesReminderSearch(sailor, 'SAIL')).toBe(true);
		expect(matchesReminderSearch(sailor, 'dr')).toBe(true);
		expect(matchesReminderSearch(sailor, 'poisoned')).toBe(false);
		expect(matchesReminderSearch(sailor, '')).toBe(true);
	});
});
