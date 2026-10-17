/**
 * Homebrew setup brackets that name characters rather than types, as in Alex S's
 * "Fall of Rome" (https://www.bloodstar.xyz/p/AlexS/Fall_of_Rome/script.json): a Minion
 * with "[+ Spartacus]" forces a homebrew Outsider into play, a Demon with "[+1 Hannibal]"
 * adds a second copy of itself, and a Townsfolk with "[+0 to +2 Legionary]" may add up to
 * two more of itself. Abilities below are placeholders; only the brackets matter.
 */
import { describe, expect, it } from 'vitest';
import type { Character, CharacterType } from '#lib/core/data/types.ts';
import { canDuplicate } from './bag-characters.ts';
import { modifierFromText, setupModifierFor } from './setup-modifiers.ts';
import { analyseSetup } from './setup.ts';

const make = (id: string, name: string, type: CharacterType, ability: string): Character => ({
	id,
	name,
	type,
	ability,
	setup: ability.includes('['),
	reminders: [],
	remindersGlobal: [],
	special: []
});

const spartacus = make('spartacus_hb', 'Spartacus', 'outsider', 'x');
const haruspex = make('haruspex_hb', 'Haruspex', 'minion', 'x [+ Spartacus]');
const hannibal = make('hannibal_hb', 'Hannibal', 'demon', 'x [+1 Hannibal]');
const legionary = make('legionary_hb', 'Legionary', 'townsfolk', 'x [+0 to +2 Legionary]');
const mercenary = make(
	'mercenary_hb',
	'Mercenary',
	'traveller',
	'x [+1 Mercenary of opposing alignment]'
);
const scholar = make('scholar_hb', 'Scholar', 'townsfolk', 'x [+1 Outsider]');
const all = [spartacus, haruspex, hannibal, legionary, mercenary, scholar];
const findByName = (name: string) =>
	all.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.id;
const findById = (id: string) => all.find((c) => c.id === id);
const townsfolk = (n: number) =>
	Array.from({ length: n }, (_, i) => make(`t${i}`, `Townsfolk ${i}`, 'townsfolk', 'x'));
const outsider = make('o0', 'Outsider', 'outsider', 'x');
const demon = make('d0', 'Demon', 'demon', 'x');
const minion = make('m0', 'Minion', 'minion', 'x');

describe('bracket reader: characters by name', () => {
	it('reads "+ Spartacus" (no "the") as a required character', () => {
		expect(modifierFromText(haruspex, findByName)).toMatchObject({
			requires: 'spartacus_hb',
			ops: [],
			notes: []
		});
	});

	it('reads "+1 Hannibal" as one more copy of itself, a Demon', () => {
		expect(modifierFromText(hannibal, findByName)).toMatchObject({
			copies: [1],
			ops: [{ kind: 'delta', type: 'demon', values: [1] }],
			notes: []
		});
	});

	it('reads "+0 to +2 Legionary" as up to two more copies, with no count change', () => {
		expect(modifierFromText(legionary)).toMatchObject({ copies: [0, 1, 2], ops: [], notes: [] });
	});

	it('reads a copy with extra words, and asks the Storyteller to check the rest', () => {
		const modifier = modifierFromText(mercenary)!;
		expect(modifier.copies).toEqual([1]);
		expect(modifier.notes[0]).toContain('of opposing alignment');
	});

	it('leaves an unknown name for the Storyteller to check', () => {
		const modifier = modifierFromText(make('x', 'X', 'minion', 'x [+ Nobody]'), findByName)!;
		expect(modifier.requires).toBeUndefined();
		expect(modifier.notes[0]).toContain('+ Nobody');
	});

	it('lets a character that adds copies of itself repeat in the bag', () => {
		expect(canDuplicate(hannibal, [hannibal])).toBe(true);
		expect(canDuplicate(legionary, [legionary])).toBe(true);
		expect(canDuplicate(haruspex, [haruspex])).toBe(false);
		expect(setupModifierFor(scholar)?.copies).toBeUndefined();
	});
});

describe('setup check with character brackets', () => {
	it('asks for Spartacus when the Haruspex is in play without it', () => {
		const analysis = analyseSetup({
			players: 7,
			inPlay: [...townsfolk(5), haruspex, demon],
			findByName,
			findById
		});
		expect(analysis.warnings.map((w) => w.code)).toContain('missing-required');
		expect(analysis.warnings.find((w) => w.code === 'missing-required')?.characters).toEqual([
			'haruspex_hb',
			'spartacus_hb'
		]);
		// Spartacus replaces a Townsfolk: 0 or 1 Outsider (7 players have none).
		expect(analysis.expected.outsider).toEqual([0, 1]);
	});

	it('is clean once Spartacus replaces a Townsfolk', () => {
		const analysis = analyseSetup({
			players: 7,
			inPlay: [...townsfolk(4), spartacus, haruspex, demon],
			findByName,
			findById
		});
		expect(analysis.warnings).toEqual([]);
		expect(analysis.notes).toEqual([]);
	});

	it('expects two Hannibals and no duplicate warning', () => {
		const analysis = analyseSetup({
			players: 7,
			inPlay: [...townsfolk(4), minion, hannibal, hannibal],
			findByName,
			findById
		});
		expect(analysis.expected.demon).toEqual([2]);
		expect(analysis.warnings).toEqual([]);
	});

	it('warns when one Hannibal is chosen', () => {
		const analysis = analyseSetup({
			players: 7,
			inPlay: [...townsfolk(5), minion, hannibal],
			findByName,
			findById
		});
		expect(analysis.warnings.map((w) => w.code)).toContain('count-mismatch');
	});

	it('allows up to three Legionaries, and warns at four', () => {
		const three = analyseSetup({
			players: 7,
			inPlay: [...townsfolk(2), legionary, legionary, legionary, minion, demon],
			findByName
		});
		expect(three.warnings).toEqual([]);
		const four = analyseSetup({
			players: 8,
			inPlay: [
				...townsfolk(1),
				legionary,
				legionary,
				legionary,
				legionary,
				outsider,
				minion,
				demon
			],
			findByName
		});
		expect(four.warnings.map((w) => w.code)).toEqual(['duplicate']);
		expect(four.warnings[0].message).toContain('at most 3');
	});
});
