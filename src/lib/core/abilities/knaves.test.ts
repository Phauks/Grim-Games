/**
 * Knaves: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Knaves
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Knaves.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker } from '#lib/core/rules/night-info.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Knaves', () => {
	const character = committedCharacter('knaves');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Knaves');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('knaves')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Knaves#Examples)', () => {
		it.fails('Example 1: Chef asks the liar, gets impossible number', () => {
			// Wiki: "There are two Storytellers, Ben and Lachlan. The Chef wakes and chooses
			// Lachlan, who is the lying Storyteller. The Chef learns a "3", even though there are
			// only 2 pairs of evil players."
			// The true number is two; nothing yet knows which Storyteller the Chef chose.
			const s = scenario([
				'chef',
				'poisoner',
				'imp',
				'scarletwoman',
				'empath',
				'monk',
				'soldier'
			]).rule('knaves');
			expect(infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!.range?.truth).toBe(2);
			engineGap(
				'unplanned',
				'which of the two Storytellers lies, so the information from the lying one must be false'
			);
		});
		it.fails('Example 2: After swap, Savant picks the truthful one', () => {
			// Wiki: "Later that game, the Storytellers switch. The Savant visits Ben and Lachlan
			// and chooses Lachlan. The Savant learns 2 pieces of true information."
			const s = scenario(['savant', 'chef', 'empath', 'poisoner', 'imp']).rule('knaves');
			expect(s.game.ruleCharacters).toContain('knaves');
			engineGap(
				'unplanned',
				'which Storyteller lies now that they have switched, so the Savant who chose the truthful one gets two true statements'
			);
		});
	});
});
