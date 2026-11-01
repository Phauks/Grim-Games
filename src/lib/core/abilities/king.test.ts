/**
 * King: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/King
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes King.
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

describe('King', () => {
	const character = committedCharacter('king');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('King');
			expect(character.type).toBe('townsfolk');
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

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('king')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/King#Examples)', () => {
		it('Example 1: King learns an alive Snitch, then an alive Witch', () => {
			// Once enough players are dead the King is shown alive characters, good or evil; a
			// dead player's character is not one of them. Before then the King doesn't wake
			// (`wakesWhen`, rules/wakes-when.test.ts).
			const s = scenario(['king', 'snitch', 'witch', 'monk', 'imp']).dies('monk').dies('imp');
			const picker = infoPicker(s.game, s.seat('king'), 'king', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('snitch')], characterId: 'snitch' })).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('witch')], characterId: 'witch' })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('monk')], characterId: 'monk' })).toBe(false);
		});
		it.todo('Example 2: Demon kills King, risking a fake Choirboy');
	});
});
