/**
 * Recluse: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Recluse
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Recluse.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Recluse', () => {
	const character = committedCharacter('recluse');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Recluse');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('recluse')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Recluse#Examples)', () => {
		it.todo("Example 1: Slayer kills Recluse, thinking it's Imp");
		it.todo("Example 2: Empath's evil count drops to zero");
		it.todo('Example 3: Investigator narrows Scarlet Woman to two players');
		it.todo('Example 4: Undertaker wrongly learns the Imp died');
		it.todo('Example 5: Chef sees zero, sparing a revealing two');
	});
});
