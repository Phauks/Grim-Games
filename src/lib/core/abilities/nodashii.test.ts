/**
 * No Dashii: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/No_Dashii
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes No Dashii.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('No Dashii', () => {
	const character = committedCharacter('nodashii');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('No Dashii');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Poisoned', 'Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('nodashii')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/No_Dashii#Examples)', () => {
		it.todo('Example 1: Poisoned neighbours die; new ones are poisoned');
		it.todo('Example 2: Poisons the closest Townsfolk on both sides');
	});
});
