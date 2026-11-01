/**
 * Choirboy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Choirboy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Choirboy.
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

describe('Choirboy', () => {
	const character = committedCharacter('choirboy');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Choirboy');
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

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('choirboy')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Choirboy#Examples)', () => {
		it('Example 1: Unprotected King dies; Choirboy learns the Imp', () => {
			// The Demon killed the King: the Choirboy is shown the Demon's player.
			const s = scenario(['choirboy', 'king', 'imp', 'monk', 'poisoner']).dies('king');
			const picker = infoPicker(s.game, s.seat('choirboy'), 'choirboy', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('poisoner')] })).toBe(false);
		});

		it('Example 2: Drunk Choirboy wrongly names the General', () => {
			// A Drunk who thinks they are the Choirboy may be shown anyone as the Demon.
			const s = scenario(['choirboy', 'king', 'shabaloth', 'general', 'poisoner'])
				.drunk('choirboy')
				.dies('king');
			const picker = infoPicker(s.game, s.seat('choirboy'), 'choirboy', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('general')] })).toBe(true);
		});
	});
});
