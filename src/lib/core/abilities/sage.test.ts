/**
 * Sage: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sage
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sage.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Sage', () => {
	const character = committedCharacter('sage');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Sage');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('sage')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sage#Examples)', () => {
		it('Example 1: Demon kills Sage early; two suspects shown', () => {
			// The Demon kills the Sage: the Storyteller points to the Demon and one other player.
			const { game: g, seats } = castGame(['sage', 'chef', 'imp', 'monk', 'poisoner'], (s) => ({
				type: 'SetDead',
				seatId: s[0],
				dead: true
			}));
			const picker = infoPicker(g, seats[0], 'sage', characters)!;
			expect(isTruthful(picker, { seats: [seats[2], seats[3]] })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1], seats[3]] })).toBe(false);
		});

		it('Example 2: Drunk Sage gets misleading info', () => {
			// A Drunk who thinks they are the Sage may be shown any two players.
			const { game: g, seats } = castGame(
				['sage', 'chef', 'imp', 'monk', 'poisoner'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[0],
					reminder: { characterId: 'drunk', label: 'Is The Drunk' }
				}),
				(s) => ({ type: 'SetDead', seatId: s[0], dead: true })
			);
			const picker = infoPicker(g, seats[0], 'sage', characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1], seats[3]] })).toBe(true);
		});
		it.todo("Example 3: Pit-Hag's arbitrary death leaves Sage uninformed");
	});
});
