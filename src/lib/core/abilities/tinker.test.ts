/**
 * Tinker: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Tinker
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Tinker.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Tinker', () => {
	const character = committedCharacter('tinker');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Tinker');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('tinker')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Tinker#Examples)', () => {
		it.todo('Example 1: Tinker dies overnight though Demon targeted another');
		it.todo("Example 2: Tea Lady's protection keeps Tinker alive");
		it.todo("Example 3: Innkeeper's death later leads to Tinker's death");
	});
});
