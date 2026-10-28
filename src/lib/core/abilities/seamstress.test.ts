/**
 * Seamstress: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Seamstress
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Seamstress.
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

describe('Seamstress', () => {
	const character = committedCharacter('seamstress');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Seamstress');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('seamstress')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Seamstress#Examples)', () => {
		it('Example 1: Two good players checked night one: yes', () => {
			// The Seamstress picks two good players on the first night: the true answer is yes.
			const { game: g, seats } = castGame(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(g, seats[0], 'seamstress', characters)!;
			expect(isTruthful(picker, { seats: [seats[1], seats[2]], yes: true })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1], seats[2]], yes: false })).toBe(false);
		});

		it('Example 2: Mixed pair on night four reads no', () => {
			// A good player and an evil player differ, whichever night the Seamstress asks.
			const { game: g, seats } = castGame(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(g, seats[0], 'seamstress', characters)!;
			expect(isTruthful(picker, { seats: [seats[2], seats[3]], yes: false })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[2], seats[3]], yes: true })).toBe(false);
		});
		it.todo("Example 3: Pit-Hag's changed Witch still reads same alignment");
	});
});
