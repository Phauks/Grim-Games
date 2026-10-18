import { describe, expect, it } from 'vitest';
import {
	homebrewScriptPage,
	readHomebrewList,
	readHomebrewScripts
} from './homebrew-scripts-api.ts';

// Shapes as botchomebrew.wiki's /scripts.json?fields=browse and /characters.json?fields=grid
// returned them on 2026-10-17 (made-up values).
const list = [
	{
		slug: 'stone-and-salt',
		name: 'Stone and Salt',
		author: 'Someone',
		description: 'A test.',
		header: 'scripts/stone-and-salt.png',
		characters: ['quarry-warden', 'off-imp', 'washerwoman'],
		classification: 'standard',
		v: 'abc123'
	},
	{ slug: 'Bad Slug', name: 'Nope', characters: [] },
	{ slug: 'nameless', name: '', characters: [] },
	'junk'
];
const grid = [
	{
		slug: 'quarry-warden',
		page: 'c/someone/quarry-warden',
		name: 'Quarry Warden',
		team: 'townsfolk'
	}
];

describe('readHomebrewScripts', () => {
	it('names and types homebrew characters from the grid and keeps official ones by id', () => {
		expect(readHomebrewScripts(list, grid)).toEqual([
			{
				slug: 'stone-and-salt',
				name: 'Stone and Salt',
				author: 'Someone',
				characters: [
					{ id: 'quarry-warden', name: 'Quarry Warden', team: 'townsfolk' },
					{ id: 'imp' },
					{ id: 'washerwoman' }
				]
			}
		]);
	});

	it('keeps a listed logo only when it is an https link or a path on the wiki', () => {
		const logos = readHomebrewScripts(
			[
				{ slug: 'a', name: 'A', logo: 'https://example.com/a.png', characters: [] },
				{ slug: 'b', name: 'B', logo: '/assets/b.png', characters: [] },
				{ slug: 'c', name: 'C', logo: 'javascript:alert(1)', characters: [] },
				{ slug: 'd', name: 'D', characters: [] }
			],
			grid
		).map((s) => s.logo);
		expect(logos).toEqual([
			'https://example.com/a.png',
			'https://botchomebrew.wiki/assets/b.png',
			undefined,
			undefined
		]);
	});

	it('reads nothing from an answer that is not a list', () => {
		expect(readHomebrewScripts({ error: 'x' }, grid)).toEqual([]);
	});
});

describe('readHomebrewList', () => {
	it('reads back our own answer, and refuses anything else', () => {
		const scripts = readHomebrewScripts(list, grid);
		expect(readHomebrewList({ scripts })).toEqual(scripts);
		expect(readHomebrewList([])).toBeUndefined();
	});
});

it('links a script to its own wiki page', () => {
	expect(homebrewScriptPage('stone-and-salt')).toBe('https://botchomebrew.wiki/s/stone-and-salt');
});
