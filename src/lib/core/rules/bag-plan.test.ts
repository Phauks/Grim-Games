import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	analyseSelection,
	planBag,
	randomSelection,
	selectedIds,
	type BagSelection
} from './bag-plan.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);
const script = (ids: string[]) => ids.map((id) => data.byId.get(id)!);

const TB = script([
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor',
	'butler',
	'drunk',
	'recluse',
	'saint',
	'poisoner',
	'spy',
	'scarletwoman',
	'baron',
	'imp'
]);
const pick = (...ids: string[]): BagSelection => Object.fromEntries(ids.map((id) => [id, 1]));
const plan = (selection: BagSelection, extra: Partial<Parameters<typeof planBag>[0]> = {}) =>
	planBag({ selection, scriptCharacters: TB, lookup, ...extra });

/** A fixed sequence of random numbers, repeating. */
const sequence =
	(...values: number[]) =>
	() => {
		const v = values.shift()!;
		values.push(v);
		return v;
	};

describe('planBag', () => {
	it('puts one tile per selected character, showing itself', () => {
		const result = plan(pick('chef', 'empath', 'monk', 'poisoner', 'imp'));
		expect(result.tiles).toEqual([
			{ shows: 'chef', grimoire: 'chef' },
			{ shows: 'empath', grimoire: 'empath' },
			{ shows: 'monk', grimoire: 'monk' },
			{ shows: 'poisoner', grimoire: 'poisoner' },
			{ shows: 'imp', grimoire: 'imp' }
		]);
		expect(result.issues).toEqual([]);
		expect(result.includeTravellers).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk's token is never in the bag; a
	// Townsfolk that is not in play goes in, and the Drunk believes they are that Townsfolk.
	it('Drunk: a Townsfolk not in play stands in, marked "Is The Drunk"', () => {
		const result = plan(pick('chef', 'empath', 'drunk', 'poisoner', 'imp'));
		const drunk = result.tiles[2];
		expect(drunk.grimoire).toBe(drunk.shows);
		expect(lookup(drunk.shows)?.type).toBe('townsfolk');
		expect(['chef', 'empath']).not.toContain(drunk.shows);
		expect(drunk.reminders).toEqual([{ characterId: 'drunk', label: 'Is The Drunk' }]);
		expect(result.standIns).toEqual([
			expect.objectContaining({ characterId: 'drunk', kind: 'good', shows: drunk.shows })
		]);
		expect(result.standIns[0].options.every((id) => lookup(id)?.type === 'townsfolk')).toBe(true);
	});

	it('Drunk: the Storyteller can choose the Townsfolk, and is warned when it is in play', () => {
		const result = plan(pick('chef', 'empath', 'drunk', 'poisoner', 'imp'), {
			standIns: { drunk: 'chef' }
		});
		expect(result.tiles[2]).toMatchObject({ shows: 'chef', grimoire: 'chef' });
		expect(result.standIns[0].chosen).toBe(true);
		expect(result.issues.map((i) => i.code)).toEqual(['stand-in-selected']);
	});

	it('two stand-ins are not shown the same Townsfolk', () => {
		const result = planBag({
			selection: { drunk: 1, marionette: 1, imp: 1 },
			scriptCharacters: script(['chef', 'empath', 'drunk', 'marionette', 'imp']),
			lookup
		});
		expect(new Set(result.tiles.slice(0, 2).map((t) => t.shows)).size).toBe(2);
	});

	// https://wiki.bloodontheclocktower.com/Marionette: the Marionette thinks they are a good
	// character; their token is not in the bag.
	it('Marionette: a good character stands in, marked "Is The Marionette"', () => {
		const result = planBag({
			selection: pick('chef', 'marionette', 'imp'),
			scriptCharacters: script(['chef', 'empath', 'saint', 'marionette', 'imp']),
			lookup,
			random: () => 0.99
		});
		expect(result.tiles[1]).toEqual({
			shows: 'saint',
			grimoire: 'saint',
			reminders: [{ characterId: 'marionette', label: 'Is The Marionette' }]
		});
		expect(result.standIns[0].options).toEqual(['chef', 'empath', 'saint']);
	});

	// https://wiki.bloodontheclocktower.com/Lunatic: the Lunatic is shown a Demon token.
	it('Lunatic: shown the Demon in play, with the Lunatic in the grimoire', () => {
		const result = planBag({
			selection: pick('lunatic', 'nodashii'),
			scriptCharacters: script(['chef', 'lunatic', 'imp', 'nodashii']),
			lookup
		});
		expect(result.tiles[0]).toEqual({ shows: 'nodashii', grimoire: 'lunatic' });
		expect(result.standIns[0]).toMatchObject({ kind: 'demon', options: ['imp', 'nodashii'] });
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta: no Demon is dealt.
	it("Lil' Monsta: no tile, and an issue says so", () => {
		const result = planBag({
			selection: pick('chef', 'poisoner', 'lilmonsta'),
			scriptCharacters: script(['chef', 'poisoner', 'lilmonsta']),
			lookup
		});
		expect(result.tiles.map((t) => t.shows)).toEqual(['chef', 'poisoner']);
		expect(result.issues.map((i) => i.code)).toEqual(['not-dealt']);
	});

	it('Fabled and Loric never go in the bag; Travellers set includeTravellers', () => {
		const result = planBag({
			selection: pick('chef', 'gunslinger', 'sentinel'),
			scriptCharacters: script(['chef', 'gunslinger', 'sentinel']),
			lookup
		});
		expect(result.tiles.map((t) => t.shows)).toEqual(['chef', 'gunslinger']);
		expect(result.includeTravellers).toBe(true);
		expect(result.issues.map((i) => i.code)).toEqual(['rule-character']);
	});

	// https://wiki.bloodontheclocktower.com/Village_Idiot: up to two extra Village Idiots.
	it('copies are separate tiles', () => {
		expect(selectedIds({ villageidiot: 3, chef: 1 }, ['chef', 'villageidiot'])).toEqual([
			'chef',
			'villageidiot',
			'villageidiot',
			'villageidiot'
		]);
	});
});

describe('analyseSelection', () => {
	const analyse = (players: number, selection: BagSelection, order = TB.map((c) => c.id)) =>
		analyseSelection({ players, selection, scriptOrder: order, lookup });

	it('counts the selection against the setup sheet', () => {
		const result = analyse(5, pick('chef', 'empath', 'monk', 'poisoner', 'imp'));
		expect(result.chosen).toEqual({ townsfolk: 3, outsider: 0, minion: 1, demon: 1 });
		expect(result.warnings).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it("Lil' Monsta changes the counts without being counted", () => {
		const result = analyse(
			8,
			pick('chef', 'empath', 'monk', 'soldier', 'mayor', 'saint', 'poisoner', 'spy', 'lilmonsta'),
			[...TB.map((c) => c.id), 'lilmonsta']
		);
		expect(result.chosen.demon).toBe(0);
		expect(result.warnings).toEqual([]);
	});

	it('selected Travellers are not dealt', () => {
		const result = analyse(7, pick('chef', 'empath', 'monk', 'poisoner', 'imp', 'gunslinger'));
		expect(result.dealt).toBe(6);
		expect(result.travellers).toBe(1);
	});
});

describe('randomSelection', () => {
	const fill = (players: number, selection: BagSelection = {}, random = sequence(0.1, 0.7, 0.4)) =>
		randomSelection({
			players,
			selection,
			scriptCharacters: TB,
			scriptOrder: TB.map((c) => c.id),
			lookup,
			random
		});

	it.each([5, 7, 8, 10, 12, 15])('fills %i players to the setup sheet', (players) => {
		const selection = fill(players);
		const result = analyseSelection({
			players,
			selection,
			scriptOrder: TB.map((c) => c.id),
			lookup
		});
		expect(result.warnings).toEqual([]);
	});

	it('keeps what was already selected', () => {
		const selection = fill(9, pick('baron', 'virgin'));
		expect(selection.baron).toBe(1);
		expect(selection.virgin).toBe(1);
		// https://wiki.bloodontheclocktower.com/Baron: +2 Outsiders.
		const result = analyseSelection({
			players: 9,
			selection,
			scriptOrder: TB.map((c) => c.id),
			lookup
		});
		expect(result.chosen.outsider).toBe(4);
		expect(result.warnings).toEqual([]);
	});

	it('fills players beyond 15 with Travellers from the script', () => {
		const withTravellers = [...TB, ...script(['gunslinger', 'beggar', 'thief'])];
		const selection = randomSelection({
			players: 17,
			selection: {},
			scriptCharacters: withTravellers,
			scriptOrder: withTravellers.map((c) => c.id),
			lookup,
			random: sequence(0.3, 0.6)
		});
		const travellers = Object.keys(selection).filter((id) => lookup(id)?.type === 'traveller');
		expect(travellers).toHaveLength(2);
	});
});
