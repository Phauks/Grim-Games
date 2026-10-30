/**
 * Alchemist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Alchemist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Alchemist.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';

describe('Alchemist', () => {
	const character = committedCharacter('alchemist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Alchemist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Alchemist']);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('alchemist')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'reveal', name: 'replace-character' }]);
		});
	});

	// How to Run: its token is swapped for the Minion whose ability it has, marked "Is The
	// Alchemist"; the player is still the good Alchemist.
	describe('a swapped token marked "Is The Alchemist"', () => {
		it('offers only Minions to swap to, whatever its alignment', () => {
			expect(rulesOf('alchemist', characters)?.swapsForAbility).toEqual({
				token: 'Is The Alchemist',
				good: ['minion'],
				evil: ['minion']
			});
		});

		it('is really the good Alchemist, a Townsfolk', () => {
			// The swap keeps the Alchemist's good alignment (SeatCharacterFlow's gain).
			const { session, seats } = castGame(
				['poisoner', 'imp', 'chef'],
				(s) => ({ type: 'SetAlignment', seatId: s[0], alignment: 'good' }),
				(s) => ({
					type: 'AddReminder',
					seatId: s[0],
					reminder: { characterId: 'alchemist', label: 'Is The Alchemist' }
				})
			);
			const game = session.game;
			expect(game.seats[seats[0]].characterId).toBe('poisoner');
			expect(trueCharacter(game, seats[0], characters)).toBe('alchemist');
			expect(typeOf(game, seats[0], characters)).toBe('townsfolk');
			expect(alignmentOf(game, seats[0])).toBe('good');
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Alchemist#Examples)', () => {
		it.todo('Example 1: Alchemist with Baron ability: two extra Outsiders');
		it.todo('Example 2: Alchemist-Poisoner switches poison target to King');
	});
});
