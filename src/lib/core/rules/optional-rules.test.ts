/**
 * Characters' optional rules: chosen at the start, on or off per game (Trevor, 2026-10-30).
 * Wiki: https://wiki.bloodontheclocktower.com/Hindu (its optional rule is the first built).
 */
import { describe, expect, it } from 'vitest';
import { rulesIn, rulesOf } from '#lib/core/data/rules/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { optionalRuleChoices } from './optional-rules.ts';

const hindu: Command = { type: 'AddRuleCharacter', characterId: 'hindu' };
const on: Command = { type: 'SetOptionalRule', characterId: 'hindu', on: true };
const cast = ['chef', 'empath', 'monk', 'poisoner', 'imp'];

describe('optional rules', () => {
	it('lists the characters in play with one, off until the game turns it on', () => {
		const off = castGame(cast, hindu);
		expect(optionalRuleChoices(off.game, characters)).toContainEqual({
			characterId: 'hindu',
			on: false
		});
		const chosen = castGame(cast, hindu, on);
		expect(optionalRuleChoices(chosen.game, characters)).toContainEqual({
			characterId: 'hindu',
			on: true
		});
	});

	it('replaces the rules it names in a game that turns it on', () => {
		const { game } = castGame(cast, hindu);
		expect(rulesIn(game, 'hindu', characters)?.reincarnates).toEqual({ first: 4 });
		const chosen = castGame(cast, hindu, on);
		expect(rulesIn(chosen.game, 'hindu', characters)?.reincarnates).toEqual({
			first: 4,
			demonTo: 'minion'
		});
		expect(rulesOf('hindu', characters)?.reincarnates).toEqual({ first: 4 });
	});

	it('turns off again', () => {
		const { game } = castGame(cast, hindu, on, {
			type: 'SetOptionalRule',
			characterId: 'hindu',
			on: false
		});
		expect(game.optionalRules).toBeUndefined();
	});

	it('refuses a character with no optional rule', () => {
		expect(() =>
			castGame(cast, { type: 'SetOptionalRule', characterId: 'chef', on: true })
		).toThrow();
	});

	it('never nests an optional rule in another', () => {
		const issues = new Issues();
		parseCharacterRules({ optionalRule: { optionalRule: {} } }, 'x', issues);
		expect(issues.list).toEqual([
			'x.optionalRule.optionalRule: an optional rule has no optional rule of its own'
		]);
	});
});
