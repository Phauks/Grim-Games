/**
 * Po: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Po
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Po.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Po', () => {
	const character = committedCharacter('po');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Po');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead', 'Dead', '3 Attacks']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('po')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Po#Examples)', () => {
		it.todo('Example 1: Kills one, skips, then triple kill');
		it.todo('Example 2: Poisoned triple attack fails; sober kill follows');
		it.todo('Example 3: Drunk mid-spree; only first target dies');
	});
});
