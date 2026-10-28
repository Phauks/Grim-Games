/**
 * Choirboy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Choirboy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Choirboy.
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

describe('Choirboy', () => {
	const character = committedCharacter('choirboy');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Choirboy');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('choirboy')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Choirboy#Examples)', () => {
		it('Example 1: Unprotected King dies; Choirboy learns the Imp', () => {
			// The Demon killed the King: the Choirboy is shown the Demon's player.
			const { game: g, seats } = castGame(['choirboy', 'king', 'imp', 'monk', 'poisoner'], (s) => ({
				type: 'SetDead',
				seatId: s[1],
				dead: true
			}));
			const picker = infoPicker(g, seats[0], 'choirboy', characters)!;
			expect(isTruthful(picker, { seats: [seats[2]] })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[4]] })).toBe(false);
		});

		it('Example 2: Drunk Choirboy wrongly names the General', () => {
			// A Drunk who thinks they are the Choirboy may be shown anyone as the Demon.
			const { game: g, seats } = castGame(
				['choirboy', 'king', 'shabaloth', 'general', 'poisoner'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[0],
					reminder: { characterId: 'drunk', label: 'Is The Drunk' }
				}),
				(s) => ({ type: 'SetDead', seatId: s[1], dead: true })
			);
			const picker = infoPicker(g, seats[0], 'choirboy', characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [seats[3]] })).toBe(true);
		});
	});
});
