/**
 * Drunk: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Drunk
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Drunk.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Drunk', () => {
	const character = committedCharacter('drunk');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Drunk');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Drunk']);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('drunk')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Drunk#Examples)', () => {
		it.todo("Example 1: Drunk who thinks they're Soldier dies to Imp");
		it.todo('Example 2: Drunk Empath gets false numbers two nights');
		it.todo('Example 3: Drunk Ravenkeeper picks Saint, is shown Poisoner');
		it.todo('Example 4: Drunk Undertaker learns the Drunk was executed');
	});
});
