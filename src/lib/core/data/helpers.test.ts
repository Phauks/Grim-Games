import { describe, expect, it } from 'vitest';
import { defaultAlignment, isSeatable } from './character-type.ts';
import { characterIcons } from './icons.ts';
import { findJinx, indexJinxes, jinxesAmong, jinxesFor } from './jinxes.ts';
import type { Character, Jinx } from './types.ts';

describe('defaultAlignment', () => {
	// https://wiki.bloodontheclocktower.com/Character_Types
	it('follows the character type', () => {
		expect(defaultAlignment('townsfolk')).toBe('good');
		expect(defaultAlignment('outsider')).toBe('good');
		expect(defaultAlignment('minion')).toBe('evil');
		expect(defaultAlignment('demon')).toBe('evil');
	});

	it('leaves travellers to the Storyteller and Fabled/Loric without one', () => {
		expect(defaultAlignment('traveller')).toBeUndefined();
		expect(defaultAlignment('fabled')).toBeUndefined();
		expect(defaultAlignment('loric')).toBeUndefined();
	});

	it('never seats Fabled or Loric', () => {
		expect(isSeatable('traveller')).toBe(true);
		expect(isSeatable('fabled')).toBe(false);
		expect(isSeatable('loric')).toBe(false);
	});
});

describe('jinx lookup', () => {
	const jinxes: Jinx[] = [
		{ characters: ['spy', 'magician'], reason: 'A' },
		{ characters: ['spy', 'poppygrower'], reason: 'B' },
		{ characters: ['lunatic', 'mathematician'], reason: 'C' }
	];
	const index = indexJinxes(jinxes);

	it('finds a pair in either order', () => {
		expect(findJinx(index, 'spy', 'magician')?.reason).toBe('A');
		expect(findJinx(index, 'magician', 'spy')?.reason).toBe('A');
		expect(findJinx(index, 'spy', 'lunatic')).toBeUndefined();
	});

	it('lists jinxes by character and among a script', () => {
		expect(jinxesFor(index, 'spy').map((j) => j.reason)).toEqual(['A', 'B']);
		expect(jinxesFor(index, 'chef')).toEqual([]);
		expect(jinxesAmong(index, ['spy', 'magician', 'lunatic']).map((j) => j.reason)).toEqual(['A']);
	});
});

describe('characterIcons', () => {
	const base: Character = {
		id: 'x',
		name: 'X',
		type: 'townsfolk',
		edition: 'tb',
		ability: '',
		setup: false,
		reminders: [],
		remindersGlobal: [],
		special: []
	};

	it('uses TPI file names for each type', () => {
		expect(characterIcons({ ...base, id: 'chef' })).toEqual({
			good: 'tb/chef_g.webp',
			evil: 'tb/chef_e.webp'
		});
		expect(characterIcons({ ...base, id: 'thief', type: 'traveller' })).toEqual({
			unaligned: 'tb/thief.webp',
			good: 'tb/thief_g.webp',
			evil: 'tb/thief_e.webp'
		});
		expect(characterIcons({ ...base, id: 'angel', type: 'fabled', edition: 'fabled' })).toEqual({
			unaligned: 'fabled/angel.webp'
		});
		expect(characterIcons({ ...base, edition: undefined })).toBeUndefined();
	});
});
