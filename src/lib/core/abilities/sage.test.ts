/**
 * Sage: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sage
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sage.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Sage', () => {
	const character = committedCharacter('sage');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Sage');
			expect(character.type).toBe('townsfolk');
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

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('sage')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sage#Examples)', () => {
		it('Example 1: Demon kills Sage early; two suspects shown', () => {
			// The Demon kills the Sage: the Storyteller points to the Demon and one other player.
			const s = scenario(['sage', 'chef', 'imp', 'monk', 'poisoner']).dies('sage');
			const picker = infoPicker(s.game, s.seat('sage'), 'sage', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp'), s.seat('monk')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef'), s.seat('monk')] })).toBe(false);
		});

		it('Example 2: Drunk Sage gets misleading info', () => {
			// A Drunk who thinks they are the Sage may be shown any two players.
			const s = scenario(['sage', 'chef', 'imp', 'monk', 'poisoner']).drunk('sage').dies('sage');
			const picker = infoPicker(s.game, s.seat('sage'), 'sage', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef'), s.seat('monk')] })).toBe(true);
		});
		it.todo("Example 3: Pit-Hag's arbitrary death leaves Sage uninformed");
	});
});
