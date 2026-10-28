/**
 * Knight: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Knight
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Knight.
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

describe('Knight', () => {
	const character = committedCharacter('knight');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Knight');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('knight')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Knight#Examples)', () => {
		it('Example 1: Knight learns Undertaker and Fortune Teller players', () => {
			// Two players who are not the Demon; a pair with the Demon is not allowed.
			const { game: g, seats } = castGame([
				'knight',
				'undertaker',
				'imp',
				'fortuneteller',
				'poisoner'
			]);
			const picker = infoPicker(g, seats[0], 'knight', characters)!;
			expect(isTruthful(picker, { seats: [seats[1], seats[3]] })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1], seats[2]] })).toBe(false);
		});

		it("Example 2: Vortox forces the Knight's info to include the Demon", () => {
			// With the Vortox in play the Knight's info must be false, so it includes the Demon.
			const { game: g, seats } = castGame(['knight', 'alchemist', 'vortox', 'chef', 'witch']);
			const picker = infoPicker(g, seats[0], 'knight', characters)!;
			expect(isAllowed(picker, { seats: [seats[2], seats[1]] })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1], seats[3]] })).toBe(false);
		});
	});
});
