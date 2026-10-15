/**
 * Marionette: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Marionette
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Marionette.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Marionette', () => {
	const character = committedCharacter('marionette');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Marionette');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Marionette']);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('marionette')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Marionette#Examples)', () => {
		it.todo('Example 1: Marionette thinks they are the Undertaker');
		it.todo('Example 2: Demon bluffs that another player is Marionette');
		it.todo('Example 3: Claim rejected; good wins');
	});
});
