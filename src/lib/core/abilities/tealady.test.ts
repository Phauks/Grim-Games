/**
 * Tea Lady: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Tea_Lady
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Tea Lady.
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
import { protection } from '#lib/core/rules/ability.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Tea Lady', () => {
	const character = committedCharacter('tealady');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Tea Lady');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Cannot Die', 'Cannot Die']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('tealady')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Tea_Lady#Examples)', () => {
		const protectedBy = (s: Scenario, ref: string) =>
			protection(s.game, s.seat(ref), s.characters, 'demon');

		it('Example 1: Protected neighbour lives until other turns evil', () => {
			// Wiki: "The Tea Lady starts the game neighbouring the Mastermind and the good Goon. The
			// Mastermind is executed and dies. Now, the Tea Lady's alive neighbours are the good Goon and the
			// Courtier. The Demon attacks the Courtier, but the Courtier remains alive. Later, the Goon turns
			// evil, and the Demon attacks the Courtier again. This time, the Courtier dies."
			const start = scenario(['tealady', 'goon', 'imp', 'chef', 'courtier', 'mastermind'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('goon'), alignment: 'good' }))
				.reminder('goon', 'tealady', 'Cannot Die');
			// An evil neighbour: the Tea Lady protects nobody.
			expect(protectedBy(start, 'goon')).toBeUndefined();

			const s = start.execute('mastermind').reminder('courtier', 'tealady', 'Cannot Die');
			expect(protectedBy(s, 'courtier')).toMatchObject({ characterId: 'tealady' });
			const evilGoon = s.do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('goon'),
				alignment: 'evil'
			}));
			expect(protectedBy(evilGoon, 'courtier')).toBeUndefined();
		});

		it.fails('Example 2: Exiled protected neighbour still lives', () => {
			// Wiki: "The Tea Lady's alive neighbours are a good Matron and a good Judge. The Matron is exiled
			// but remains alive."
			const s = scenario(['tealady', 'matron', 'imp', 'chef', 'poisoner', 'judge'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('matron'), alignment: 'good' }))
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('judge'), alignment: 'good' }))
				.reminder('matron', 'tealady', 'Cannot Die');
			expect(protection(s.game, s.seat('matron'), s.characters, 'execution')).toMatchObject({
				characterId: 'tealady'
			});
			// Waits on the engine (M15m): Exile kills a living Traveller without checking protection.
			const exiled = s.do((at) => ({ type: 'Exile', seatId: at.seat('matron') }));
			expect(exiled.game.seats[exiled.seat('matron')].dead).toBe(false);
		});
	});
});
