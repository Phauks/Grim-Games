/**
 * Vortox: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vortox
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vortox.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Vortox', () => {
	const character = committedCharacter('vortox');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Vortox');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('vortox')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vortox#Examples)', () => {
		it.todo('Example 1: Vortox kills Sage; Sage sees non-Demons');
		it.todo("Example 2: Mutant's execution: two Townsfolk say yes");
		it.todo('Example 3: Dreamer narrows Savant to two characters');
		it.todo("Example 4: Pit-Hag's change gives Juggler true info");
		it('Example 5: Nobody executed, so evil wins', () => {
			const { session } = castGame(['chef', 'empath', 'monk', 'witch', 'vortox'], {
				type: 'NewDay'
			});
			expect(gameEnds(session.game, testCharacters, { dayEnded: true })).toMatchObject([
				{ rule: 'vortox', winner: 'evil' }
			]);
		});
	});
});
