/**
 * Pixie: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pixie
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pixie.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker, isAllowed, isTruthful, learnedRoles } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Pixie', () => {
	const character = committedCharacter('pixie');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Pixie');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Mad', 'Has Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('pixie')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('night info (https://wiki.bloodontheclocktower.com/Pixie#How_to_Run)', () => {
		it('is shown an in-play Townsfolk, the one marked Mad', () => {
			const { game: g, seats } = castGame(
				['pixie', 'washerwoman', 'butler', 'imp', 'monk'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[1],
					reminder: { characterId: 'pixie', label: 'Mad' }
				})
			);
			const picker = infoPicker(g, seats[0], 'pixie', characters)!;
			expect(isTruthful(picker, { seats: [seats[1]], characterId: 'washerwoman' })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[2]], characterId: 'butler' })).toBe(false);
			expect(isAllowed(picker, { seats: [seats[3]], characterId: 'imp' })).toBe(false);
			expect(learnedRoles(g, picker, characters)!.rows[0]).toMatchObject({
				target: seats[1],
				marked: true
			});
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pixie#Examples)', () => {
		it.todo('Example 1: Pixie gains Washerwoman power after mad claim');
		it.todo("Example 2: Drunk Pixie's fake Lycanthrope attacks never work");
		it.todo('Example 3: Shared Soldier claim denies Pixie the ability');
	});
});
