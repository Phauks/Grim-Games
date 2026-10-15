/**
 * Heretic: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Heretic
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Heretic.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Heretic', () => {
	const character = committedCharacter('heretic');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Heretic');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('heretic')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Heretic#Examples)', () => {
		it.todo('Example 1: Day-one claim prompts Demon suicide; evil wins');
		it.todo('Example 2: Heretic waits, forces good execution; good wins');
		it.todo('Example 3: Saint executed while Heretic dead; good wins');
		it.todo('Example 4: Poisoned Heretic; Assassin kills Demon, good wins');
		it.todo('Example 5: Demon executed with three alive; evil wins');
	});
});
