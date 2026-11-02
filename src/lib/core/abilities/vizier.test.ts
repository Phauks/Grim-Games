/**
 * Vizier: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vizier
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vizier.
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
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { executionSavers, protection } from '#lib/core/rules/ability.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Vizier', () => {
	const character = committedCharacter('vizier');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Vizier');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('vizier')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vizier#Examples)', () => {
		it('Example 1: Vizier spares King, executes Boomdandy at once', () => {
			// Wiki: "The King has been nominated. Five people vote, but the Vizier does not use their
			// ability. The Boomdandy is nominated and eight people vote. The Vizier uses their ability
			// and the Boomdandy is executed immediately."
			const s = scenario(['vizier', 'king', 'boomdandy', 'chef', 'empath', 'imp'])
				.nominate('chef', 'king')
				.nominate('empath', 'boomdandy');
			expect(
				validDeathCauses(s.game, s.seat('boomdandy'), s.characters).map((c) => c.cause)
			).toContain('vizier');
			const after = s.do({ type: 'Execute', seatId: s.seat('boomdandy'), cause: 'vizier' });
			expect(after.game.seats[s.seat('boomdandy')]).toMatchObject({
				dead: true,
				deathCause: 'vizier'
			});
			expect(after.game.seats[s.seat('king')].dead).toBe(false);
		});
		it('Example 2: Vizier forces an execution, sparing the Demon', () => {
			// Wiki: "The Demon has seven votes against them, and is “about to die”. The Vizier
			// nominates Bill, the Barber. Two evil players and one good player vote. The Vizier
			// declares that Bill is executed. The Demon survives today."
			const s = scenario(['vizier', 'barber', 'chef', 'empath', 'poisoner', 'imp', 'monk'])
				.nominate('chef', 'imp')
				.nominate('vizier', 'barber')
				.do((at) => ({ type: 'Execute', seatId: at.seat('barber'), cause: 'vizier' }));
			expect(s.game.seats[s.seat('barber')].dead).toBe(true);
			// Executing the Demon too would be a second execution today.
			expect(warned(s.session, s.ctx, { type: 'Execute', seatId: s.seat('imp') })).toContain(
				'already-executed'
			);
		});
		it("Example 3: Town's execution fails; Demon kills Vizier later", () => {
			// Wiki: "The town nominates and executes the Vizier. The Vizier does not die. That night,
			// The Demon kills the Vizier."
			const s = scenario(['vizier', 'chef', 'empath', 'poisoner', 'imp']);
			expect(executionSavers(s.game, s.seat('vizier'), s.characters)[0]).toEqual({
				source: { characterId: 'vizier', seatId: s.seat('vizier') }
			});
			const day = s.nominate('chef', 'vizier').execute('vizier');
			expect(day.game.seats[s.seat('vizier')].dead).toBe(false);
			expect(protection(day.game, s.seat('vizier'), day.characters, 'demon')).toBeUndefined();
		});
	});
});
