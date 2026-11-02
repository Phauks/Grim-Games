/**
 * Deviant: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Deviant
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Deviant.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { exileThreshold } from '#lib/core/rules/voting.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Deviant', () => {
	const character = committedCharacter('deviant');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Deviant');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
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
			expect(nightSheetPresence('deviant')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Deviant#Examples)', () => {
		const table = (alignment: 'good' | 'evil') =>
			scenario(['deviant', 'chef', 'empath', 'monk', 'witch', 'nodashii']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('deviant'),
				alignment
			}));

		it.fails('Example 1: Storyteller saves funny Deviant from exile', () => {
			// Wiki: "The evil Deviant cracks a few jokes, and gets a few laughs, but the players
			// nevertheless decide to exile them. Even though there are enough votes, the Storyteller
			// decides to keep the Deviant alive."
			// Waits on the engine: Exile always kills a living Traveller; it has no way to log the
			// exile while the Deviant's ability keeps them alive.
			const s = table('evil');
			expect(exileThreshold(s.game, s.characters)).toBeDefined();
			const after = s.do((at) => ({ type: 'Exile', seatId: at.seat('deviant') }));
			expect(after.game.today.entries).toMatchObject([
				{ kind: 'exile', seatId: s.seat('deviant') }
			]);
			expect(after.game.seats[after.seat('deviant')].dead).toBe(false);
		});

		it.fails('Example 2: Spared after mild humour, exiled after a flop', () => {
			// Wiki: "On the third day, the Deviant was slightly funny, and cannot be exiled. On the fourth
			// day, the Deviant was not very funny, and is successfully exiled."
			// Waits on the engine: Exile always kills a living Traveller; it has no way to log the
			// exile while the Deviant's ability keeps them alive.
			const dayThree = table('good')
				.newDay()
				.newDay()
				.do((at) => ({ type: 'Exile', seatId: at.seat('deviant') }));
			expect(dayThree.game.seats[dayThree.seat('deviant')].dead).toBe(false);
			const dayFour = dayThree.newDay().do((at) => ({ type: 'Exile', seatId: at.seat('deviant') }));
			expect(dayFour.game.seats[dayFour.seat('deviant')]).toMatchObject({
				dead: true,
				deathCause: 'exile'
			});
		});
	});
});
