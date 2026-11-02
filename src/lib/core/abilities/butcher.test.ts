/**
 * Butcher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Butcher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Butcher.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { extraNominationOpen } from '#lib/core/rules/nominations.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Butcher', () => {
	const character = committedCharacter('butcher');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Butcher');
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
			expect(nightSheetPresence('butcher')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Butcher#Examples)', () => {
		it.fails("Example 1: Witch's execution enables a Sage execution", () => {
			// Wiki: "The Witch is executed and dies. The Butcher then nominates the Sage, who gets enough
			// votes to be executed. The Sage dies too."
			// Waits on the engine: Execute warns already-executed even when the Butcher's extra
			// nomination led to the day's second execution.
			const s = scenario(['butcher', 'chef', 'witch', 'sage', 'fanggu'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('butcher'), alignment: 'good' }))
				.nominate('chef', 'witch')
				.execute('witch');
			expect(s.game.seats[s.seat('witch')].dead).toBe(true);
			expect(extraNominationOpen(s.game, s.seat('butcher'), s.characters)).toBe(true);
			const nominated = s.nominate('butcher', 'sage');
			const second = { type: 'Execute', seatId: s.seat('sage') } as const;
			const after = nominated.do(second);
			expect(after.game.seats[after.seat('sage')].dead).toBe(true);
			expect(warned(nominated.session, nominated.ctx, second)).not.toContain('already-executed');
		});

		it("Example 2: Exiles don't trigger a Butcher nomination", () => {
			// Wiki: "The Bone Collector is exiled, and then the Harlot is exiled. There are no executions
			// today. The Butcher does not get to nominate again, because exiles are not executions."
			const s = scenario(['butcher', 'bonecollector', 'harlot', 'chef', 'empath', 'fanggu'])
				.do(
					(at) => ({ type: 'SetAlignment', seatId: at.seat('butcher'), alignment: 'good' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('bonecollector'), alignment: 'evil' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('harlot'), alignment: 'good' })
				)
				.nominate('butcher', 'chef')
				.do((at) => ({ type: 'Exile', seatId: at.seat('bonecollector') }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('harlot') }));
			expect(s.game.seats[s.seat('harlot')].dead).toBe(true);
			expect(extraNominationOpen(s.game, s.seat('butcher'), s.characters)).toBe(false);
			expect(
				warned(s.session, s.ctx, {
					type: 'Nominate',
					nominator: s.seat('butcher'),
					nominee: s.seat('empath')
				})
			).toContain('already-nominated');
		});

		it.fails('Example 3: Failed nominee renominated after another execution', () => {
			// Wiki: "The Butcher nominates the Town Crier, but the Town Crier is not executed. The
			// Mathematician gets more votes and is executed today. The game continues, and the Butcher
			// nominates the Town Crier again. This time, enough hands are raised, and the Town Crier is
			// executed."
			// Waits on the engine: Execute warns already-executed even when the Butcher's extra
			// nomination led to the day's second execution.
			const s = scenario(['butcher', 'towncrier', 'mathematician', 'chef', 'nodashii'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('butcher'), alignment: 'good' }))
				.nominate('butcher', 'towncrier')
				.nominate('chef', 'mathematician')
				.execute('mathematician');
			const again = {
				type: 'Nominate',
				nominator: s.seat('butcher'),
				nominee: s.seat('towncrier')
			} as const;
			// The once-a-day limits are lifted for the Butcher and the Town Crier alike.
			expect(warned(s.session, s.ctx, again)).toEqual([]);
			const nominated = s.do(again);
			const second = { type: 'Execute', seatId: s.seat('towncrier') } as const;
			expect(nominated.do(second).game.seats[s.seat('towncrier')].dead).toBe(true);
			expect(warned(nominated.session, nominated.ctx, second)).not.toContain('already-executed');
		});
	});
});
