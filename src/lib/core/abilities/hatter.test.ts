/**
 * Hatter: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Hatter
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Hatter.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { rulesIn } from '#lib/core/data/rules/index.ts';

describe('Hatter', () => {
	const character = committedCharacter('hatter');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Hatter');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Tea Party Tonight']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('hatter')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Hatter#Examples)', () => {
		it.todo("Example 1: Ojo and Devil's Advocate change characters");
		it.todo('Example 2: Both evils refuse changes to keep Vigormortis');
		it.todo('Example 3: Assassin becomes Mastermind, Mastermind picks Assassin');
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Hatter): when
// the Hatter dies, the Demon may become a Minion and a Minion the Demon.
describe('Hatter optional rule', () => {
	const cast = ['hatter', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'hatter', on: true };

	it('off, each Minion and the Demon picks from their own type', () => {
		const { game } = castGame(cast);
		const rule = rulesIn(game, 'hatter', characters)?.changesCharacter;
		expect(rule).toMatchObject({ types: ['minion', 'demon'], sameType: true });
		expect(rule?.anyType).toBeUndefined();
	});

	it('on, they may pick a Minion or a Demon', () => {
		const { game } = castGame(cast, on);
		expect(rulesIn(game, 'hatter', characters)?.changesCharacter).toMatchObject({
			sameType: true,
			anyType: true
		});
	});
});
