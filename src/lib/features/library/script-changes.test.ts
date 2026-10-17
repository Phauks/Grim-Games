import { describe, expect, it } from 'vitest';
import { hasChanges, scriptChanges } from './script-changes.ts';

const original = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'fortune_teller',
	{ id: 'stormwarden', team: 'townsfolk', ability: 'Each night, choose a player.' },
	'imp'
];

describe('scriptChanges', () => {
	it('finds nothing between a script and itself, whatever the spelling or key order', () => {
		const same = [
			{ author: 'Trevor', id: '_meta', name: 'Storm Front' },
			'Washerwoman',
			'fortuneteller',
			{ ability: 'Each night, choose a player.', id: 'stormwarden', team: 'townsfolk' },
			{ id: 'imp' }
		];
		expect(hasChanges(scriptChanges(original, same))).toBe(false);
	});

	it('lists characters added and removed, in each script’s order', () => {
		const changes = scriptChanges(original, [original[0], 'chef', 'washerwoman', 'imp', 'baron']);
		expect(changes.added).toEqual(['chef', 'baron']);
		expect(changes.removed).toEqual(['fortune_teller', 'stormwarden']);
		expect(changes.edited).toEqual([]);
	});

	it('marks a character whose own definition changed', () => {
		const changes = scriptChanges(original, [
			...original.slice(0, 3),
			{ id: 'stormwarden', team: 'townsfolk', ability: 'Each night*, choose a player.' },
			'imp'
		]);
		expect(changes.edited).toEqual(['stormwarden']);
		expect(changes.added).toEqual([]);
	});

	it('states the name and author on both sides, and other details changed', () => {
		const changes = scriptChanges(original, [
			{ id: '_meta', name: 'Storm Front (no Imp)', author: 'Trevor', logo: 'https://x/y.png' },
			...original.slice(1)
		]);
		expect(changes.name).toEqual({ from: 'Storm Front', to: 'Storm Front (no Imp)' });
		expect(changes.author).toBeUndefined();
		expect(changes.otherDetails).toBe(true);
	});

	it('reads a script with no meta and ignores junk entries', () => {
		const changes = scriptChanges(['chef', 4, null], ['chef', 'imp']);
		expect(changes.added).toEqual(['imp']);
		expect(changes.name).toBeUndefined();
	});
});
