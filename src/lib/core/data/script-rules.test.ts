/**
 * A script's own rules and starting Fabled and Loric.
 * https://wiki.bloodontheclocktower.com/Bootlegger, https://wiki.bloodontheclocktower.com/Fabled
 */
import { describe, expect, it } from 'vitest';
import { committedGameData, committedCharacters } from '#lib/core/testing/committed-data.ts';
import type { Script } from '#lib/core/data/types.ts';
import { characterLookup } from '#lib/core/model/characters.ts';
import { createGame } from '#lib/core/engine/log.ts';
import { testContext } from '#lib/core/model/fixtures.test-support.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { loadScript } from '#lib/core/data/script.ts';
import { ruleSources, scriptOrderSource } from '#lib/core/rules/rule-sources.ts';
import { scriptRules, startingRuleCharacters } from './script-rules.ts';
import { setupModifierFor } from '#lib/core/rules/setup/setup-modifiers.ts';

const data = committedGameData();

// A made-up one-line rule in the shape of a World Cup 2025 script's `_meta.bootlegger`
// (https://botc-script-viewer.sthom.kiwi/wc25/), split over two lines as some of them are.
const RULES = ['One seat stays empty', 'and the Storyteller plays it.'];

const script = (ids: string[], bootlegger?: string[]): Script => ({
	meta: { name: 'Test', ...(bootlegger ? { bootlegger } : {}) },
	entries: ids.map((id) => ({ kind: 'official', id }))
});

describe('scriptRules', () => {
	it('reads the Bootlegger lines, dropping empty ones', () => {
		expect(scriptRules({ name: 'x', bootlegger: [' A rule. ', '', '  '] })).toEqual(['A rule.']);
		expect(scriptRules(undefined)).toEqual([]);
	});
});

describe('startingRuleCharacters', () => {
	it('starts with the Fabled and Loric on the script, in script order', () => {
		const s = script(['chef', 'ferryman', 'imp', 'spiritofivory']);
		expect(startingRuleCharacters(s, characterLookup(data, s))).toEqual([
			'ferryman',
			'spiritofivory'
		]);
	});

	// Trevor, 2026-10-17: the app never mentions the Djinn; jinxes show on their own.
	it('leaves out the Djinn even when the script lists it', () => {
		const s = script(['djinn', 'spy', 'magician']);
		expect(startingRuleCharacters(s, characterLookup(data, s))).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Bootlegger: a script with homebrew rules.
	it('adds the Bootlegger when the script has rules, once', () => {
		const withRules = script(['chef', 'imp'], RULES);
		expect(startingRuleCharacters(withRules, characterLookup(data, withRules))).toEqual([
			'bootlegger'
		]);
		const listed = script(['bootlegger', 'chef'], RULES);
		expect(startingRuleCharacters(listed, characterLookup(data, listed))).toEqual(['bootlegger']);
		const none = script(['chef', 'imp']);
		expect(startingRuleCharacters(none, characterLookup(data, none))).toEqual([]);
	});

	it('puts them in play when the game is created', () => {
		const s = script(['ferryman', 'chef', 'imp'], RULES);
		const created = createGame(
			{ type: 'CreateGame', script: s, playerCount: 5 },
			testContext({ characters: characterLookup(data, s) })
		);
		expect(created.ok && created.session.game.ruleCharacters).toEqual(['ferryman', 'bootlegger']);
	});

	it('starts with the Fabled and Loric New game chose instead, when it chose', () => {
		const s = script(['ferryman', 'chef', 'imp'], RULES);
		const ctx = testContext({ characters: characterLookup(data, s) });
		const chosen = createGame(
			{ type: 'CreateGame', script: s, playerCount: 5, ruleCharacters: ['angel'] },
			ctx
		);
		expect(chosen.ok && chosen.session.game.ruleCharacters).toEqual(['angel']);
		const none = createGame(
			{ type: 'CreateGame', script: s, playerCount: 5, ruleCharacters: [] },
			ctx
		);
		expect(none.ok && none.session.game.ruleCharacters).toEqual([]);
		const seated = createGame(
			{ type: 'CreateGame', script: s, playerCount: 5, ruleCharacters: ['chef'] },
			ctx
		);
		expect(seated.ok ? 'ok' : seated.error.code).toBe('not-rule-character');
	});
});

describe('the Bootlegger in a game', () => {
	it("shows the script's rules as its ability, joined into one text", () => {
		const s = script(['chef', 'imp'], RULES);
		expect(characterLookup(data, s).get('bootlegger')?.ability).toBe(
			'One seat stays empty and the Storyteller plays it.'
		);
	});

	it("keeps TPI's ability when the script has no rules", () => {
		const s = script(['chef', 'imp']);
		expect(characterLookup(data, s).get('bootlegger')?.ability).toBe(
			data.byId.get('bootlegger')?.ability
		);
	});
});

// M61f: a script may say what its Bootlegger lines do, as a rules block in
// `_meta.bootleggerRules`, read by the same readers as a character's `rules`. The lines are
// Trained Killer's (https://beardytas.com/garden-of-djinn/trained-killer/), a Script World Cup
// 2025 rule carried as a Bootlegger line.
describe("the script's rules block (bootleggerRules)", () => {
	const LINE =
		'Each night*, the Demon attacks the next living in-play character(s) in script order.';
	const withBlock = (block: unknown, lines: string[] = [LINE]) =>
		loadScript(
			[{ id: '_meta', name: 'Test', bootlegger: lines, bootleggerRules: block }, 'chef', 'imp'],
			data
		);

	it('loads the block beside the lines, which stay the text', () => {
		const loaded = withBlock({ demonAttack: { target: 'script-order' } });
		expect(loaded.problems).toEqual([]);
		expect(loaded.script?.meta.bootlegger).toEqual([LINE]);
		expect(loaded.script?.meta.bootleggerRules).toEqual({
			demonAttack: { target: 'script-order' }
		});
	});

	it('leaves out a rule it cannot read, with a warning, and keeps the rest', () => {
		const loaded = withBlock({ demonAttack: { target: 'script-order' }, flies: true });
		expect(loaded.script?.meta.bootleggerRules).toEqual({
			demonAttack: { target: 'script-order' }
		});
		expect(loaded.problems.map((p) => p.message)).toEqual([
			'Ignored its rule "flies", which this app can\'t use: rules.flies: unknown rule.'
		]);
	});

	it('leaves out a block with no lines, since players could not read the rule', () => {
		const loaded = withBlock({ demonAttack: { target: 'script-order' } }, [' ']);
		expect(loaded.script?.meta.bootleggerRules).toBeUndefined();
		expect(loaded.problems.map((p) => p.message)).toEqual([
			'Ignored the homebrew rules block (bootleggerRules): it needs bootlegger lines.'
		]);
	});

	const s: Script = {
		meta: {
			name: 'Test',
			bootlegger: [LINE],
			bootleggerRules: { demonAttack: { target: 'script-order' } }
		},
		entries: ['chef', 'empath', 'imp'].map((id) => ({ kind: 'official', id }))
	};

	it("lays the block over the Bootlegger's own rules", () => {
		const rules = rulesOf('bootlegger', characterLookup(data, s));
		expect(rules?.demonAttack).toEqual({ target: 'script-order' });
		expect(rules?.reminderTargets).toEqual(
			rulesOf('bootlegger', committedCharacters())?.reminderTargets
		);
	});

	it('the engine acts on it while the Bootlegger is in play', () => {
		const characters = characterLookup(data, s);
		const created = createGame(
			{ type: 'CreateGame', script: s, playerCount: 5 },
			testContext({ characters })
		);
		if (!created.ok) throw new Error(created.error.code);
		const game = created.session.game;
		expect(game.ruleCharacters).toEqual(['bootlegger']);
		expect(scriptOrderSource(ruleSources(game, characters, []))?.name).toBe('Bootlegger');
		const without = { ...game, ruleCharacters: [] };
		expect(scriptOrderSource(ruleSources(without, characters, []))).toBeUndefined();
	});

	it("a setupModifier in the block replaces reading the lines' brackets", () => {
		const bracketed: Script = {
			meta: { name: 'Test', bootlegger: ['Two Demons. [+1 Demon]'] },
			entries: [{ kind: 'official', id: 'imp' }]
		};
		const read = setupModifierFor(characterLookup(data, bracketed).get('bootlegger')!);
		expect(read?.source).toBe('ability-text');
		const said: Script = {
			...bracketed,
			meta: {
				...bracketed.meta!,
				bootleggerRules: {
					setupModifier: {
						summary: '+1 Demon',
						ops: [{ kind: 'delta', type: 'demon', values: [1] }]
					}
				}
			}
		};
		const modifier = setupModifierFor(characterLookup(data, said).get('bootlegger')!);
		expect(modifier?.source).toBe('table');
		expect(modifier?.ops).toEqual([{ kind: 'delta', type: 'demon', values: [1] }]);
	});
});
