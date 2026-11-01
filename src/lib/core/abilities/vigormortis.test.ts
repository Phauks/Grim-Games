/**
 * Vigormortis: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vigormortis
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vigormortis.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Vigormortis', () => {
	const character = committedCharacter('vigormortis');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Vigormortis');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([
				'Dead',
				'Has Ability',
				'Has Ability',
				'Has Ability',
				'Poisoned',
				'Poisoned',
				'Poisoned'
			]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('vigormortis')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vigormortis#Examples)', () => {
		it.todo("Example 1: Killed Witch's curse continues");
		it.todo('Example 2: Storyteller poisons Sage past the Klutz');
		it.todo("Example 3: Pit-Hag's chain of changes ends with Vortox");
	});
});
