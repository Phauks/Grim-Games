/**
 * Matron: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Matron
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Matron.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { aliveNeighbours } from '#lib/core/model/selectors.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Matron', () => {
	const character = committedCharacter('matron');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Matron');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
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
			expect(nightSheetPresence('matron')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Matron#Examples)', () => {
		it('Example 1: Evil Matron seats themself beside Tea Lady', () => {
			// Wiki: "The evil Matron rearranges the seating order so that she is sitting next to the Tea
			// Lady. This way, the two of them can whisper to each other, and the Tea Lady's ability does
			// not work."
			const s = scenario(['matron', 'chef', 'tealady', 'empath', 'monk', 'imp'])
				.becomes('matron', 'matron', 'evil')
				.reminder('chef', 'tealady', 'Cannot Die')
				.reminder('empath', 'tealady', 'Cannot Die');
			expect(protection(s.game, s.seat('empath'), s.characters, 'demon')).toMatchObject({
				characterId: 'tealady'
			});
			const swapped = s
				.newDay()
				.do((at) => ({ type: 'SwapSeats', seatA: at.seat('matron'), seatB: at.seat('chef') }));
			expect(aliveNeighbours(swapped.game, swapped.seat('tealady'))).toContain(
				swapped.seat('matron')
			);
			// An evil neighbour: the Tea Lady protects nobody.
			expect(
				protection(swapped.game, swapped.seat('empath'), swapped.characters, 'demon')
			).toBeUndefined();
		});
		it('Example 2: Good Matron separates suspected Demon and Minion', () => {
			// Wiki: "The good Matron swaps the seating position of the player they think is the Demon,
			// so that player is far away from the player they think is the Minion. They may not
			// whisper to each other now."
			const s = scenario(['matron', 'chef', 'empath', 'monk', 'poisoner', 'imp']).becomes(
				'matron',
				'matron',
				'good'
			);
			expect(aliveNeighbours(s.game, s.seat('imp'))).toContain(s.seat('poisoner'));
			const swapped = s
				.newDay()
				.do((at) => ({ type: 'SwapSeats', seatA: at.seat('imp'), seatB: at.seat('empath') }));
			expect(aliveNeighbours(swapped.game, swapped.seat('imp'))).not.toContain(
				swapped.seat('poisoner')
			);
		});
	});
});
