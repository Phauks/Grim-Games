/**
 * A script's own rules and starting Fabled and Loric.
 * https://wiki.bloodontheclocktower.com/Bootlegger, https://wiki.bloodontheclocktower.com/Fabled
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Script } from '#lib/core/data/types.ts';
import { characterLookup } from '#lib/core/model/characters.ts';
import { createGame } from '#lib/core/engine/log.ts';
import { testContext } from '#lib/core/model/fixtures.test-support.ts';
import { scriptRules, startingRuleCharacters } from './script-rules.ts';

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
