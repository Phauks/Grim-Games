/**
 * Mutant: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mutant
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mutant.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Mutant', () => {
	const character = committedCharacter('mutant');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition snv', () => {
			expect(character.name).toBe('Mutant');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('mutant')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mutant#Examples)', () => {
		it.todo('Example 1: Mutant admits identity; executed immediately');
		it.todo("Example 2: Witch reports Mutant's Klutz claim; Mutant executed");
		it.todo('Example 3: Silent Mutant claiming Townsfolk is executed');
		it.todo('Example 4: Fake Oracle with a winking denial, executed');
	});
});
