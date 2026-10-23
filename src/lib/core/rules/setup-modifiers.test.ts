/**
 * Setup modifier table and the [bracket] reader for homebrew.
 * https://wiki.bloodontheclocktower.com/Abilities (brackets change setup only)
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Character } from '#lib/core/data/types.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { bracketText, modifierFromText, setupModifierFor } from './setup-modifiers.ts';

const data = committedGameData();
const CURATED_SETUP_IDS = [...OFFICIAL_RULES].flatMap(([id, r]) => (r.setupModifier ? [id] : []));
const byName = (name: string) =>
	data.characters.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.id;

const homebrew = (ability: string): Character => ({
	id: 'hb',
	name: 'Homebrew',
	type: 'minion',
	ability,
	setup: true,
	reminders: [],
	remindersGlobal: [],
	special: []
});

describe('curated table', () => {
	it('covers every official character with setup: true', () => {
		const missing = data.characters
			.filter((c) => c.setup && !CURATED_SETUP_IDS.includes(c.id))
			.map((c) => c.id);
		expect(missing).toEqual([]);
	});

	it('only lists official characters, each with a wiki page', () => {
		for (const id of CURATED_SETUP_IDS) {
			const character = data.byId.get(id);
			expect(character, id).toBeDefined();
			expect(setupModifierFor(character!)?.wiki, id).toMatch(
				/^https:\/\/wiki\.bloodontheclocktower\.com\/\S+$/
			);
		}
	});

	it('agrees with the bracket reader wherever the text is plain numbers', () => {
		for (const id of ['baron', 'godfather', 'fanggu', 'vigormortis', 'balloonist', 'hermit']) {
			const character = data.byId.get(id)!;
			const fromText = modifierFromText(character, byName)!;
			expect(fromText.ops, id).toEqual(setupModifierFor(character)!.ops);
			expect(fromText.notes, id).toEqual([]);
		}
	});
});

describe('custom characters', () => {
	// A homebrew Minion that adds Outsiders, as the Baron does
	// (https://wiki.bloodontheclocktower.com/Baron), with no bracket in its text.
	it('change setup through their rules block', () => {
		const warden: Character = {
			...homebrew('There are extra Outsiders in play.'),
			rules: {
				setupModifier: {
					summary: '+1 Outsider',
					ops: [{ kind: 'delta', type: 'outsider', values: [1] }],
					notes: ['Swap a Townsfolk for an Outsider.']
				}
			}
		};
		expect(setupModifierFor(warden)).toMatchObject({
			summary: '+1 Outsider',
			ops: [{ kind: 'delta', type: 'outsider', values: [1] }],
			notes: ['Swap a Townsfolk for an Outsider.'],
			source: 'table'
		});
	});
});

describe('bracket reader', () => {
	it('finds bracketed text', () => {
		expect(bracketText('Each night*, choose a player: they die. [+1 Outsider]')).toBe(
			'+1 Outsider'
		);
		expect(bracketText('No brackets.')).toBeUndefined();
	});

	it('reads deltas, "or", "to", unknown amounts, "No …" and "+the …"', () => {
		expect(modifierFromText(homebrew('x [+2 Outsiders]'))!.ops).toEqual([
			{ kind: 'delta', type: 'outsider', values: [2] }
		]);
		expect(modifierFromText(homebrew('x [-1 or +1 Outsider]'))!.ops[0]).toMatchObject({
			values: [-1, 1]
		});
		expect(modifierFromText(homebrew('x [-0 or -1 Outsider]'))!.ops[0]).toMatchObject({
			values: [0, -1]
		});
		expect(modifierFromText(homebrew('x [+0 to +2 Townsfolk]'))!.ops[0]).toMatchObject({
			type: 'townsfolk',
			values: [0, 1, 2]
		});
		expect(modifierFromText(homebrew('x [−1 Minion]'))!.ops[0]).toMatchObject({
			type: 'minion',
			values: [-1]
		});
		expect(modifierFromText(homebrew('x [-? to +? Outsiders]'))!.ops).toEqual([
			{ kind: 'any', type: 'outsider' }
		]);
		expect(modifierFromText(homebrew('x [No Demon]'))!.ops).toEqual([
			{ kind: 'set', type: 'demon', values: [0] }
		]);
		expect(modifierFromText(homebrew('x [+the King]'), byName)!.requires).toBe('king');
	});

	it('asks the Storyteller to check text it cannot read', () => {
		const modifier = modifierFromText(homebrew('x [Everyone sits on the floor]'))!;
		expect(modifier).toMatchObject({ source: 'ability-text', ops: [] });
		expect(modifier.notes[0]).toContain('Everyone sits on the floor');
	});

	it('reads a homebrew copy of an official id from its own text', () => {
		const baron = { ...data.byId.get('baron')!, edition: undefined, ability: 'x [+1 Outsider]' };
		expect(setupModifierFor(baron)).toMatchObject({
			source: 'ability-text',
			ops: [{ values: [1] }]
		});
	});

	// https://wiki.bloodontheclocktower.com/Bootlegger: the script's own rules, which may
	// carry a setup bracket (Binary Supernovae's extra Demon).
	it("applies a bracket in the Bootlegger's script rules and keeps its table note", () => {
		const official = data.byId.get('bootlegger')!;
		const bootlegger = { ...official, ability: 'Summoner only removes 1 Demon. [+1 Demon]' };
		const modifier = setupModifierFor(bootlegger, byName);
		expect(modifier?.ops).toEqual([{ kind: 'delta', type: 'demon', values: [1] }]);
		expect(modifier?.notes).toEqual(
			expect.arrayContaining([...(setupModifierFor(official)?.notes ?? [])])
		);
	});

	it('leaves a Bootlegger without a bracket to the table', () => {
		const official = data.byId.get('bootlegger')!;
		expect(setupModifierFor(official)).toMatchObject({ source: 'table' });
	});
});
