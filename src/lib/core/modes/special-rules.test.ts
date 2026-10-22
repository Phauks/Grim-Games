/**
 * Special rules: a game mode plus rules that stack (Trevor, 2026-10-18, "Yes, split";
 * /mnt/project-files/world-cup-rules/format-design.md). The library rules come from the Script
 * World Cup 2025 pages they cite (https://beardytas.com/garden-of-djinn/).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { combineRules } from './combine.ts';
import { GAME_MODES, STANDARD, gameModeById } from './registry.ts';
import { SPECIAL_RULES, upgradeModeChoice } from './rules/index.ts';
import { SCRIPT_RULE_ID, scriptSpecialRule } from './script-rule.ts';
import { SPECIAL_RULE_FORMAT, type SpecialRule } from './types.ts';
import { parseGameMode, parseModeOrRule, parseSpecialRule } from './validate.ts';

const known = new Set(committedGameData().characters.map((c) => c.id));

const rule = (id: string, parts: SpecialRule['parts'], extra: Partial<SpecialRule> = {}) =>
	({
		kind: 'special-rule',
		format: SPECIAL_RULE_FORMAT,
		id,
		name: id,
		sources: [{ title: 'Rules', url: 'https://example.com/' }],
		parts,
		...extra
	}) satisfies SpecialRule;

describe('reading a special rule file', () => {
	it('accepts every library rule', () => {
		for (const r of SPECIAL_RULES)
			expect(parseSpecialRule(r, known), r.id).toEqual({ ok: true, rule: r });
	});

	it('gives every library rule a description for the picker (Trevor, 2026-10-19)', () => {
		const missing = SPECIAL_RULES.filter((rule) => !rule.about?.trim()).map((rule) => rule.id);
		expect(missing).toEqual([]);
	});

	// Trevor, 2026-10-19: "If there are no restricted characters ... shouldn't it be standard?"
	// A part that changes nothing is left out, so Inspect shows it as Standard.
	it('sets no part of a library rule or mode to nothing', () => {
		const empty = (value: unknown): boolean =>
			Array.isArray(value)
				? value.length === 0
				: typeof value === 'object' &&
					value !== null &&
					Object.values(value).length > 0 &&
					Object.values(value).every((v) => Array.isArray(v) && v.length === 0);
		const found = [...SPECIAL_RULES, ...GAME_MODES].flatMap((m) =>
			Object.entries(m.parts)
				.filter(([, value]) => empty(value))
				.map(([part]) => `${m.id}.${part}`)
		);
		expect(found).toEqual([]);
	});

	// Trevor, 2026-10-22: +1's "Special information characters: None" read like a default. An
	// empty list anywhere inside a part shows as "None" in Inspect, so a field with nothing in
	// it is left out instead. These two empty lists mean something and stay.
	it('leaves out every empty list inside a library rule or mode', () => {
		const meant = [
			// "Only" these characters' setup effects apply: none of them.
			'sushi-buffet.setupModifiers.characters',
			// The Storyteller picks each town's script on New game.
			'two-games-at-once.pool.scripts'
		];
		const emptyLists = (value: unknown, path: string): string[] =>
			Array.isArray(value)
				? value.length === 0
					? [path]
					: value.flatMap((v, i) => emptyLists(v, `${path}[${i}]`))
				: typeof value === 'object' && value !== null
					? Object.entries(value).flatMap(([k, v]) => emptyLists(v, `${path}.${k}`))
					: [];
		const found = [...SPECIAL_RULES, ...GAME_MODES]
			.flatMap((m) => emptyLists(m.parts, m.id))
			.filter((path) => !meant.includes(path));
		expect(found).toEqual([]);
	});

	it('refuses the parts only a game mode sets, saying why', () => {
		const parsed = parseSpecialRule({
			...rule('x', {}),
			parts: {
				assignment: { kind: 'bag' },
				towns: { count: 2, storytellers: 2 },
				counts: { kind: 'standard' },
				betweenGames: { kind: 'campaign' },
				pool: { kind: 'all-characters' }
			}
		});
		expect(parsed.ok ? [] : parsed.issues).toEqual([
			'parts.assignment: only a game mode changes how characters are dealt',
			'parts.towns: only a game mode adds towns',
			'parts.counts: a special rule changes counts with countChanges',
			'parts.betweenGames: only a game mode links games',
			'parts.pool.kind: a special rule can only add hidden characters to the script'
		]);
	});

	it('checks the parts only a rule has', () => {
		const parsed = parseSpecialRule(
			{
				...rule('x', {}),
				parts: {
					text: ['ok', 3],
					countChanges: [
						{ kind: 'delta', type: 'demon', values: [1] },
						{ kind: 'delta', type: 'fabled', values: ['x'] }
					],
					travellers: { inBag: -1, announced: 'no' },
					seats: { kind: 'storyteller-seat', count: 0, speaks: 'never' },
					deaths: { kind: 'public' },
					nightSteps: [{ kind: 'wake', when: 'each-night', characters: ['nobody'] }]
				}
			},
			known
		);
		expect(parsed.ok ? [] : parsed.issues).toEqual([
			'parts.text: must be a list of lines',
			'parts.countChanges[1].type: must be one of townsfolk, outsider, minion, demon',
			'parts.countChanges[1].values: must be a list of whole numbers',
			'parts.travellers.inBag: must be a whole number',
			'parts.travellers.announced: must be true or false',
			'parts.seats.count: must be a whole number of at least 1',
			'parts.deaths.kind: must be one of private',
			'parts.nightSteps[0].characters[0]: unknown character nobody'
		]);
	});

	it('reads a file without a kind as a game mode, and a rule file by its kind', () => {
		const mode = { ...STANDARD };
		expect(parseModeOrRule(mode)).toEqual({ ok: true, mode });
		expect(parseModeOrRule(SPECIAL_RULES[0])).toEqual({ ok: true, rule: SPECIAL_RULES[0] });
		expect(parseGameMode({ ...STANDARD, kind: 'special-rule' }).ok).toBe(false);
		// A game mode can't use a rule's own parts.
		const seats = parseGameMode({
			...STANDARD,
			parts: { seats: { kind: 'storyteller-seat', count: 1, speaks: 'never' } }
		});
		expect(seats.ok ? [] : seats.issues).toEqual(['parts.seats: unknown part']);
	});

	it('keeps rule ids apart from mode ids and the script rule', () => {
		const ids = [...GAME_MODES.map((m) => m.id), ...SPECIAL_RULES.map((r) => r.id), SCRIPT_RULE_ID];
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('combining a mode with special rules', () => {
	it('joins lists and adds count changes in order', () => {
		const a = rule('a', {
			text: ['A.'],
			countChanges: [{ kind: 'delta', type: 'demon', values: [1] }],
			restricted: { banned: ['pithag'] },
			forced: { inPlay: [], ruleCharacters: ['ferryman'] }
		});
		const b = rule('b', {
			text: ['B.'],
			countChanges: [{ kind: 'delta', type: 'demon', values: [1] }],
			restricted: { banned: ['pithag', 'engineer'] },
			forced: { inPlay: ['witch'] }
		});
		const { parts, conflicts } = combineRules(STANDARD, [a, b]);
		expect(conflicts).toEqual([]);
		expect(parts.text).toEqual(['A.', 'B.']);
		expect(parts.countChanges).toHaveLength(2);
		expect(parts.restricted?.banned).toEqual(['pithag', 'engineer']);
		expect(parts.forced).toEqual({ inPlay: ['witch'], ruleCharacters: ['ferryman'] });
	});

	it("keeps the mode's own bans, and runs its day steps before a rule's", () => {
		const whale = gameModeById('whale-buffet')!;
		const step = { kind: 'spectator-vote' } as const;
		const { parts } = combineRules(whale, [
			rule('a', { restricted: { banned: ['chef'] }, daySteps: [step] })
		]);
		expect(parts.restricted?.banned).toEqual([...whale.parts.restricted!.banned, 'chef']);
		expect(parts.restricted?.notChoosable).toEqual(whale.parts.restricted!.notChoosable);
		expect(parts.daySteps).toEqual([step]);
	});

	it('warns when two set a single-answer part differently, and keeps the first', () => {
		const whale = gameModeById('whale-buffet')!;
		const { parts, conflicts } = combineRules(whale, [
			rule('a', { bluffs: { kind: 'standard' } }),
			rule('b', { deaths: { kind: 'private' } }),
			rule('c', { deaths: { kind: 'private' } })
		]);
		expect(conflicts).toEqual([{ ids: ['whale-buffet', 'a'], part: 'bluffs' }]);
		expect(parts.bluffs).toEqual(whale.parts.bluffs);
		expect(parts.deaths).toEqual({ kind: 'private' });
	});

	it("lets a rule's hidden extras add to a script, not to a mode that replaces it", () => {
		const extras = {
			kind: 'script-plus-hidden',
			extras: { townsfolk: 1 },
			announceRange: false
		} as const;
		expect(combineRules(STANDARD, [rule('a', { pool: extras })]).parts.pool).toEqual(extras);
		const whale = gameModeById('whale-buffet')!;
		expect(combineRules(whale, [rule('a', { pool: extras })]).conflicts).toEqual([
			{ ids: ['whale-buffet', 'a'], part: 'pool' }
		]);
	});

	it("warns about a rule's own conflicts, once, in the order chosen", () => {
		const a = rule('a', {});
		const b = rule('b', {}, { conflictsWith: { rules: ['a'], modes: ['standard'] } });
		const c = rule('c', {}, { conflictsWith: { rules: ['b'] } });
		expect(combineRules(STANDARD, [a, b, c]).conflicts).toEqual([
			{ ids: ['standard', 'b'] },
			{ ids: ['a', 'b'] },
			{ ids: ['b', 'c'] }
		]);
	});
});

describe("a script's own rule", () => {
	// https://beardytas.com/garden-of-djinn/binary-supernovae/
	it('reads brackets in its lines into count changes', () => {
		const r = scriptSpecialRule({
			name: 'Binary Supernovae',
			bootlegger: [
				'If a Demon dies by execution, good wins. Summoner only removes 1 Demon. [+1 Demon]'
			]
		});
		expect(r?.id).toBe(SCRIPT_RULE_ID);
		expect(r?.parts.text).toHaveLength(1);
		expect(r?.parts.countChanges).toEqual([{ kind: 'delta', type: 'demon', values: [1] }]);
	});

	it('is plain text without brackets, and absent without lines', () => {
		const r = scriptSpecialRule({ name: 'Seat 7', bootlegger: ['Seat 7 remains empty.'] });
		expect(r?.parts).toEqual({ text: ['Seat 7 remains empty.'] });
		expect(scriptSpecialRule({ name: 'x' })).toBeUndefined();
		expect(scriptSpecialRule({ name: 'x', bootlegger: [' '] })).toBeUndefined();
	});
});

describe('games saved in a mode that became a rule', () => {
	// Trevor, 2026-10-18: Specters and Infinite Possibilities stack on a mode now.
	it('read as Standard with that rule', () => {
		expect(upgradeModeChoice('specters')).toEqual({ modeId: 'standard', ruleIds: ['specters'] });
		expect(upgradeModeChoice('infinite-possibilities', ['seat-7'])).toEqual({
			modeId: 'standard',
			ruleIds: ['infinite-possibilities', 'seat-7']
		});
		expect(upgradeModeChoice('sushi-buffet', ['specters'])).toEqual({
			modeId: 'sushi-buffet',
			ruleIds: ['specters']
		});
	});
});

// Trevor (2026-10-22): "<script> +1", the script plus exactly one off-script character.
describe('+1', () => {
	const rule = (id: string) => SPECIAL_RULES.find((r) => r.id === id)!;

	it('adds exactly one character from off the script, of any type', () => {
		expect(rule('plus-one').parts.pool).toMatchObject({
			kind: 'script-plus-hidden',
			count: { min: 1, max: 1 },
			announceRange: false
		});
	});

	it('warns when chosen with A Script of Infinite Possibilities', () => {
		const { conflicts } = combineRules(STANDARD, [
			rule('plus-one'),
			rule('infinite-possibilities')
		]);
		expect(conflicts).toEqual([{ ids: ['plus-one', 'infinite-possibilities'], part: 'pool' }]);
	});
});

// https://beardytas.com/garden-of-djinn/binary-supernovae/: one more Demon; an executed
// Demon wins it for good (game-end.test.ts).
describe('Binary Supernovae', () => {
	const supernovae = SPECIAL_RULES.find((r) => r.id === 'binary-supernovae')!;

	it("adds a Demon through its line's bracket, as the game's Bootlegger reads it", () => {
		const onBootlegger = scriptSpecialRule({ name: 'Any', bootlegger: supernovae.parts.text });
		expect(onBootlegger?.parts.countChanges).toEqual([
			{ kind: 'delta', type: 'demon', values: [1] }
		]);
	});

	it('ends the game on an executed Demon', () => {
		expect(supernovae.parts.winConditions?.kind).toBe('demon-executed');
	});
});
