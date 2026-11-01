/**
 * Devil's Advocate: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Devil%27s_Advocate
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Devil's Advocate.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe("Devil's Advocate", () => {
	const character = committedCharacter('devilsadvocate');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe("Devil's Advocate");
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Survives Execution']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('devilsadvocate')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Devil%27s_Advocate#Examples)', () => {
		it.todo("Example 1: Devil's Advocate protects themself, survives execution");
		it.todo('Example 2: Protected Zombuul survives one execution, then dies');
		it.todo('Example 3: Protects several players with mixed outcomes');
	});
});
