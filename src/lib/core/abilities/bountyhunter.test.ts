/**
 * Bounty Hunter: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bounty_Hunter
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bounty Hunter.
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

describe('Bounty Hunter', () => {
	const character = committedCharacter('bountyhunter');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Bounty Hunter');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('bountyhunter')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bounty_Hunter#Examples)', () => {
		it('Example 1: Bounty Hunter finds an evil Harpy, then another', () => {
			// The Bounty Hunter is shown an evil player, such as the Harpy; never a good one.
			const { game: g, seats } = castGame(['bountyhunter', 'harpy', 'imp', 'chef', 'monk']);
			const picker = infoPicker(g, seats[0], 'bountyhunter', characters)!;
			expect(isTruthful(picker, { seats: [seats[1]] })).toBe(true);
			expect(isTruthful(picker, { seats: [seats[2]] })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[3]] })).toBe(false);
		});
		it.todo('Example 2: Poisoned Bounty Hunter gets a good player instead');
		it('Example 3: Drunk Bounty Hunter learns two good players', () => {
			// A Drunk who thinks they are the Bounty Hunter may be shown a good player.
			const { game: g, seats } = castGame(
				['bountyhunter', 'harpy', 'imp', 'chef', 'monk'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[0],
					reminder: { characterId: 'drunk', label: 'Is The Drunk' }
				})
			);
			const picker = infoPicker(g, seats[0], 'bountyhunter', characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [seats[3]] })).toBe(true);
		});
	});
});
