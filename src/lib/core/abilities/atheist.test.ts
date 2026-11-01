/**
 * Atheist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Atheist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Atheist.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Atheist', () => {
	const character = committedCharacter('atheist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Atheist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('atheist')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'good-duplicate' },
				{ type: 'selection', name: 'evil-duplicate' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Atheist#Examples)', () => {
		it.todo('Example 1: False info and unexplained deaths in one night');
		it.todo('Example 2: Extra Outsider appears; executing Storyteller wins');
	});
});
