/**
 * Godfather: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Godfather
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Godfather.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Godfather', () => {
	const character = committedCharacter('godfather');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Godfather');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Died Today', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('godfather')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Godfather#Examples)', () => {
		it.todo('Example 1: Godfather bluffs Tinker while Lunatic is executed');
		it.todo('Example 2: Protected Tinker dies later; Godfather sacrifices themself');
	});
});
