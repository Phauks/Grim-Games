/**
 * Ravenkeeper: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ravenkeeper
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ravenkeeper.
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

describe('Ravenkeeper', () => {
	const character = committedCharacter('ravenkeeper');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Ravenkeeper');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('ravenkeeper')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ravenkeeper#Examples)', () => {
		it('Example 1: Imp kills Ravenkeeper, who learns the Empath', () => {
			// The dead Ravenkeeper chooses the Empath's player and is shown the Empath.
			const { game: g, seats } = castGame(
				['ravenkeeper', 'empath', 'imp', 'monk', 'poisoner'],
				(s) => ({
					type: 'SetDead',
					seatId: s[0],
					dead: true
				})
			);
			const picker = infoPicker(g, seats[0], 'ravenkeeper', characters)!;
			expect(isTruthful(picker, { seats: [seats[1]], characterId: 'empath' })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[1]], characterId: 'monk' })).toBe(false);
		});

		it('Example 2: Mayor bounce kills Ravenkeeper; Recluse shows Scarlet Woman', () => {
			// A dead Recluse chosen by the Ravenkeeper may register as a Minion and be shown as one.
			const { game: g, seats } = castGame(
				['ravenkeeper', 'recluse', 'imp', 'mayor', 'scarletwoman'],
				(s) => ({ type: 'SetDead', seatId: s[0], dead: true }),
				(s) => ({ type: 'SetDead', seatId: s[1], dead: true })
			);
			const picker = infoPicker(g, seats[0], 'ravenkeeper', characters)!;
			const minion = { seats: [seats[1]], characterId: 'scarletwoman' };
			expect(isAllowed(picker, minion)).toBe(true);
			expect(isTruthful(picker, minion)).toBe(false);
			expect(isTruthful(picker, { seats: [seats[1]], characterId: 'recluse' })).toBe(true);
		});

		it('may choose any player, themselves included (How to Run)', () => {
			const { game: g, seats } = castGame(['ravenkeeper', 'empath', 'imp', 'monk', 'poisoner']);
			const picker = infoPicker(g, seats[0], 'ravenkeeper', characters)!;
			expect(isTruthful(picker, { seats: [seats[0]], characterId: 'ravenkeeper' })).toBe(true);
		});
	});
});
