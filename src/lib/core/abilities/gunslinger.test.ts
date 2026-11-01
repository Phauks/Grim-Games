/**
 * Gunslinger: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gunslinger
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gunslinger.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Gunslinger', () => {
	const character = committedCharacter('gunslinger');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Gunslinger');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('gunslinger')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gunslinger#Examples)', () => {
		it.fails("Example 1: Voter shot; Imp's execution still proceeds", () => {
			// Waits on voting in the engine: who voted, and the nominee staying about to die.
			const s = scenario(['gunslinger', 'chef', 'imp', 'monk', 'poisoner'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' }))
				.nominate('chef', 'imp');
			expect(dayUseDeath(s.game, 'gunslinger', s.seat('monk'), s.characters)).toBe('dies');
			engineGap(
				'M9',
				"the Gunslinger may choose only a player who voted, and the vote's result stands"
			);
		});
		it.fails("Example 2: Only the day's first vote tally counts", () => {
			// An exile doesn't count as the first vote for execution.
			scenario(['gunslinger', 'thief', 'butler', 'saint', 'imp', 'chef'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'good' }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('thief') }))
				.nominate('chef', 'butler');
			engineGap(
				'M9',
				"the Gunslinger's ability is offered after the day's first vote for execution only"
			);
		});
	});
});
