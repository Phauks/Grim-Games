/**
 * Rules suite for https://wiki.bloodontheclocktower.com/Setup
 *
 * The page sends the Storyteller to the setup sheet for counts (the counts here are the
 * physical sheet's, 02-game-rules-primer.md §2), says players beyond fifteen become
 * Travellers, and that [bracketed] setup text changes which characters are dealt, the
 * Baron's +2 Outsiders being its example, with as many characters as players afterwards.
 * Each modifier test cites the character's own page.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Character } from '#lib/core/data/types.ts';
import { BASE_DISTRIBUTION, splitPlayers } from '../distribution.ts';
import { isNotDealt } from '../bag-plan.ts';
import { analyseSetup, NOT_DEALT, type SetupInput } from '../setup.ts';

const data = committedGameData();
const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);
const findByName = (name: string) =>
	data.characters.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;
const findById = (id: string) => data.byId.get(id);
const analyse = (players: number, inPlay: Character[] = [], extra: Partial<SetupInput> = {}) =>
	analyseSetup({ players, inPlay, findByName, findById, ...extra });

describe('distribution per player count', () => {
	const table: [number, number, number, number, number][] = [
		[5, 3, 0, 1, 1],
		[6, 3, 1, 1, 1],
		[7, 5, 0, 1, 1],
		[8, 5, 1, 1, 1],
		[9, 5, 2, 1, 1],
		[10, 7, 0, 2, 1],
		[11, 7, 1, 2, 1],
		[12, 7, 2, 2, 1],
		[13, 9, 0, 3, 1],
		[14, 9, 1, 3, 1],
		[15, 9, 2, 3, 1]
	];
	it.each(table)(
		'%i players: %i Townsfolk, %i Outsiders, %i Minions, %i Demon',
		(players, townsfolk, outsider, minion, demon) => {
			expect(BASE_DISTRIBUTION[players]).toEqual({ townsfolk, outsider, minion, demon });
			const result = analyse(players);
			expect(result.expected).toEqual({
				townsfolk: [townsfolk],
				outsider: [outsider],
				minion: [minion],
				demon: [demon]
			});
			expect(result.warnings).toEqual([]);
		}
	);

	it('adds up to the player count', () => {
		for (const [players, counts] of Object.entries(BASE_DISTRIBUTION)) {
			expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(Number(players));
		}
	});
});

describe('Travellers beyond fifteen', () => {
	it('makes everyone beyond 15 a Traveller', () => {
		expect(splitPlayers(18)).toMatchObject({
			dealt: 15,
			travellers: 3,
			counts: BASE_DISTRIBUTION[15]
		});
		expect(analyse(20)).toMatchObject({ dealt: 15, travellers: 5, warnings: [] });
	});

	it('takes chosen Travellers out of the deal in smaller games', () => {
		expect(splitPlayers(10, 2)).toMatchObject({
			dealt: 8,
			travellers: 2,
			counts: BASE_DISTRIBUTION[8]
		});
	});

	it('warns, but still answers, outside 5–15 dealt players', () => {
		expect(splitPlayers(4).warnings[0]).toContain('at least 5');
		expect(splitPlayers(4).counts).toEqual({ townsfolk: 2, outsider: 0, minion: 1, demon: 1 });
		expect(splitPlayers(17, 0).warnings[0]).toContain('Travellers');
	});

	it('ignores Travellers, Fabled and Loric in the counts', () => {
		const result = analyse(7, [
			...get('chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp'),
			...get('thief', 'djinn', 'bigwig')
		]);
		expect(result.warnings).toEqual([]);
	});
});

describe('[bracketed] setup modifiers', () => {
	// https://wiki.bloodontheclocktower.com/Baron
	it('Baron: +2 Outsiders, -2 Townsfolk', () => {
		const result = analyse(8, get('baron'));
		expect(result.expected).toMatchObject({
			townsfolk: [3],
			outsider: [3],
			minion: [1],
			demon: [1]
		});
		expect(result.modifiers[0].explanation).toBe('Baron: +2 Outsiders');
	});

	it('warns when the chosen characters do not match, naming the cause', () => {
		const result = analyse(7, get('chef', 'empath', 'monk', 'soldier', 'mayor', 'baron', 'imp'));
		expect(result.chosen).toEqual({ townsfolk: 5, outsider: 0, minion: 1, demon: 1 });
		expect(result.warnings.map((w) => w.message)).toEqual([
			'5 Townsfolk chosen; expected 3 for 7 players.',
			'0 Outsiders chosen; expected 2 for 7 players (Baron: +2 Outsiders).'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Godfather
	it('Godfather: one fewer or one more Outsider', () => {
		expect(analyse(9, get('godfather')).expected.outsider).toEqual([1, 3]);
		// With no Outsiders to remove, only +1 is possible.
		expect(analyse(7, get('godfather')).expected.outsider).toEqual([0, 1]);
	});

	// https://wiki.bloodontheclocktower.com/Fang_Gu
	it('Fang Gu: +1 Outsider', () => {
		expect(analyse(10, get('fanggu')).expected).toMatchObject({ townsfolk: [6], outsider: [1] });
	});

	// https://wiki.bloodontheclocktower.com/Vigormortis
	it('Vigormortis: -1 Outsider, and nothing changes with none', () => {
		expect(analyse(9, get('vigormortis')).expected).toMatchObject({
			townsfolk: [6],
			outsider: [1]
		});
		expect(analyse(7, get('vigormortis')).expected).toMatchObject({
			townsfolk: [5],
			outsider: [0]
		});
	});

	// https://wiki.bloodontheclocktower.com/Balloonist and /Hermit
	it('Balloonist: +0 or +1; Hermit: -0 or -1', () => {
		expect(analyse(8, get('balloonist')).expected.outsider).toEqual([1, 2]);
		expect(analyse(8, get('hermit')).expected.outsider).toEqual([0, 1]);
	});

	// https://wiki.bloodontheclocktower.com/Huntsman
	it('Huntsman: the Damsel must be in play, adding an Outsider if she was not', () => {
		const without = analyse(
			7,
			get('huntsman', 'chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp')
		);
		expect(without.expected.outsider).toEqual([0, 1]);
		expect(without.warnings.map((w) => w.code)).toEqual(['missing-required']);
		expect(without.warnings[0].message).toBe(
			'Huntsman needs the Damsel in play: swap a Townsfolk for the Damsel.'
		);
		const withDamsel = analyse(
			7,
			get('huntsman', 'chef', 'empath', 'monk', 'damsel', 'poisoner', 'imp')
		);
		expect(withDamsel.warnings).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Choirboy
	it('Choirboy: the King must be in play; counts do not change', () => {
		const result = analyse(
			7,
			get('choirboy', 'chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp')
		);
		expect(result.expected.townsfolk).toEqual([5]);
		expect(result.warnings[0].characters).toEqual(['choirboy', 'king']);
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it('Lil’ Monsta: no Demon is dealt, and one more Minion', () => {
		expect(analyse(8, get('lilmonsta')).expected).toEqual({
			townsfolk: [5],
			outsider: [1],
			minion: [2],
			demon: [0]
		});
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it('Lil’ Monsta is not dealt to anyone, so it is not counted as a chosen Demon', () => {
		const result = analyse(
			8,
			get('lilmonsta', 'poisoner', 'spy', 'butler', 'chef', 'empath', 'monk', 'mayor', 'slayer')
		);
		expect(result.chosen).toEqual({ townsfolk: 5, outsider: 1, minion: 2, demon: 0 });
		expect(result.notDealt).toEqual(['lilmonsta']);
		expect(result.warnings.map((w) => w.code)).toEqual([]);
	});

	it('the setup check and the bag plan agree on which characters are never dealt', () => {
		for (const c of data.characters) expect(NOT_DEALT.has(c.id), c.id).toBe(isNotDealt(c));
	});

	// https://wiki.bloodontheclocktower.com/Drunk
	it('the Drunk is kept out of the bag but still counts as an Outsider', () => {
		const result = analyse(
			8,
			get('drunk', 'imp', 'poisoner', 'chef', 'empath', 'monk', 'mayor', 'slayer')
		);
		expect(result.chosen.outsider).toBe(1);
		expect(result.notDealt).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Summoner
	it('Summoner: no Demon, a Townsfolk instead', () => {
		const result = analyse(7, get('summoner'));
		expect(result.expected).toMatchObject({ townsfolk: [6], demon: [0] });
		expect(result.notes).toContain('Summoner: Put a Townsfolk in the bag instead of the Demon.');
	});

	// https://wiki.bloodontheclocktower.com/Atheist
	it('Atheist: no evil characters, any Outsider count', () => {
		const result = analyse(6, get('atheist'));
		expect(result.expected).toEqual({
			townsfolk: [0, 1, 2, 3, 4, 5, 6],
			outsider: [0, 1, 2, 3, 4, 5, 6],
			minion: [0],
			demon: [0]
		});
	});

	// https://wiki.bloodontheclocktower.com/Kazali
	it('Kazali: no Minions dealt, any Outsider count', () => {
		const result = analyse(10, get('kazali'));
		expect(result.expected.minion).toEqual([0]);
		expect(result.expected.outsider).toHaveLength(11);
		expect(result.notes.join(' ')).toContain('first night');
	});

	// https://wiki.bloodontheclocktower.com/Lord_of_Typhon
	it('Lord of Typhon: +1 Minion, any Outsider count', () => {
		const result = analyse(10, get('lordoftyphon'));
		expect(result.expected.minion).toEqual([3]);
		expect(result.expected.outsider[0]).toBe(0);
		expect(result.notes.join(' ')).toContain('row');
	});

	// https://wiki.bloodontheclocktower.com/Legion
	it('Legion: most players are Legion and duplicates are fine', () => {
		const legion = data.byId.get('legion')!;
		const result = analyse(10, [...Array(7).fill(legion), ...get('chef', 'empath', 'butler')]);
		expect(result.expected.demon).toEqual([6, 7, 8, 9]);
		expect(result.expected.minion).toEqual([0]);
		expect(result.warnings).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Xaan
	it('Xaan: any number of Outsiders', () => {
		expect(analyse(7, get('xaan')).expected.outsider).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	});

	// https://wiki.bloodontheclocktower.com/Riot
	it('Riot: no setup change in the current wording', () => {
		const result = analyse(10, get('riot'));
		expect(result.expected).toMatchObject({ minion: [2], demon: [1], outsider: [0] });
		expect(result.modifiers[0].summary).toBe('No setup change');
	});

	// https://wiki.bloodontheclocktower.com/Marionette and /Drunk
	it('Marionette and Drunk: counts unchanged, bag notes added', () => {
		const result = analyse(8, get('marionette', 'drunk'));
		expect(result.expected).toMatchObject({ townsfolk: [5], outsider: [1], minion: [1] });
		expect(result.notes).toEqual(
			expect.arrayContaining([
				'Marionette: Put a Townsfolk in the bag instead of the Marionette.',
				'Drunk: Put a Townsfolk in the bag instead of the Drunk.'
			])
		);
	});

	// https://wiki.bloodontheclocktower.com/Sentinel
	it('Sentinel (Fabled): one more, one fewer, or the same number of Outsiders', () => {
		expect(analyse(9, get('sentinel')).expected.outsider).toEqual([1, 2, 3]);
	});

	it('stacks modifiers (Baron with Fang Gu)', () => {
		expect(analyse(10, get('baron', 'fanggu')).expected).toMatchObject({
			townsfolk: [4],
			outsider: [3]
		});
	});

	it('reads homebrew bracket text, flagged as such, and warns on text it cannot read', () => {
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
		const read = analyse(8, [homebrew('x [+1 Outsider]')]);
		expect(read.modifiers[0]).toMatchObject({
			source: 'ability-text',
			explanation: 'Homebrew: +1 Outsider'
		});
		expect(read.expected.outsider).toEqual([2]);
		const unread = analyse(8, [homebrew('x [All players are frogs]')]);
		expect(unread.warnings[0].code).toBe('unread-setup-text');
	});

	it('warns about duplicates unless the character allows them', () => {
		const imp = data.byId.get('imp')!;
		expect(
			analyse(5, [imp, imp, ...get('chef', 'empath', 'monk')]).warnings.map((w) => w.code)
		).toContain('duplicate');
	});
});
