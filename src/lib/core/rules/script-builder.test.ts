/**
 * Script builder order and output. Order is TPI's Sort Order (sort-order.ts), grouped by type
 * as on every official script, e.g. https://wiki.bloodontheclocktower.com/Trouble_Brewing.
 */
import { describe, expect, it } from 'vitest';
import { loadScript } from '#lib/core/data/script.ts';
import { sortByStandardOrder } from '#lib/core/data/sort-order.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { builtScriptJson, scriptOrder } from './script-builder.ts';

const data = committedGameData();

describe('scriptOrder', () => {
	it('groups by type: Townsfolk, Outsiders, Minions, Demons, then Travellers and Fabled', () => {
		expect(
			scriptOrder(['djinn', 'imp', 'gunslinger', 'baron', 'butler', 'chef'], data).map(
				(id) => data.byId.get(id)!.type
			)
		).toEqual(['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled']);
	});

	it("uses TPI's Sort Order within a type, whatever order they were picked in", () => {
		const picked = ['undertaker', 'washerwoman', 'empath', 'chef'];
		const sorted = sortByStandardOrder(picked.map((id) => data.byId.get(id)!)).map((c) => c.id);
		expect(scriptOrder(picked, data)).toEqual(sorted);
		expect(scriptOrder([...picked].reverse(), data)).toEqual(sorted);
	});

	it('drops unknown ids and repeats', () => {
		expect(scriptOrder(['chef', 'nobody', 'chef'], data)).toEqual(['chef']);
	});
});

describe('builtScriptJson', () => {
	it('writes _meta then ids, and loads back without problems', () => {
		const json = builtScriptJson(['imp', 'chef'], { name: ' Mine ', author: '' }, data);
		expect(json).toEqual([{ id: '_meta', name: 'Mine' }, 'chef', 'imp']);
		const result = loadScript(json, data);
		expect(result.problems.filter((p) => p.severity !== 'info')).toEqual([]);
		expect(result.script?.name).toBe('Mine');
	});

	it('keeps the author when given', () => {
		expect(builtScriptJson(['chef'], { name: '', author: 'Trevor' }, data)[0]).toEqual({
			id: '_meta',
			name: '',
			author: 'Trevor'
		});
	});

	// Trevor, 2026-10-18: a version number can be set in the builder.
	it('keeps the version when given, and it loads back', () => {
		const json = builtScriptJson(['chef'], { name: 'V', author: '', version: ' 1.2 ' }, data);
		expect(json[0]).toEqual({ id: '_meta', name: 'V', version: '1.2' });
		expect(loadScript(json, data).script?.meta.version).toBe('1.2');
		expect(builtScriptJson(['chef'], { name: 'V', author: '', version: ' ' }, data)[0]).toEqual({
			id: '_meta',
			name: 'V'
		});
	});

	it('writes homebrew characters as their objects, sorted with the rest', () => {
		const homebrew = {
			lantern: {
				id: 'lantern',
				name: 'Lantern',
				team: 'outsider',
				ability: 'You start knowing 1 player.'
			},
			broken: { id: 'broken', name: 'Broken', team: 'nonsense', ability: '' }
		};
		const json = builtScriptJson(
			['imp', 'lantern', 'broken', 'chef'],
			{ name: 'Mixed', author: '' },
			data,
			homebrew
		);
		expect(json).toEqual([{ id: '_meta', name: 'Mixed' }, 'chef', homebrew.lantern, 'imp']);
		const result = loadScript(json, data);
		expect(result.script?.homebrew).toEqual(['lantern']);
	});
});
