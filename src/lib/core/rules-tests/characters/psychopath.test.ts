/**
 * Psychopath: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Psychopath
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Psychopath.
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
import { executionSavers, protection } from '#lib/core/rules/abilities/protection.ts';
import { dayUseDeath, dayUseOf } from '#lib/core/rules/day/day-claims.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { nominatorsAfterExecution } from '#lib/core/rules/day/nominations.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Psychopath', () => {
	const character = committedCharacter('psychopath');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Psychopath');
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

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('psychopath')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Psychopath#Examples)', () => {
		it('Example 1: Sober Sailor targeted, so they survive', () => {
			// Wiki: "The Psychopath chooses to kill the Sailor. The Sailor is sober, so does not die.
			// The Psychopath may not use their ability again today."
			// The Sailor's protection flags the kill for the Storyteller (warn, never lock).
			const s = scenario(['psychopath', 'sailor', 'chef', 'empath', 'imp']);
			expect(dayUseOf(s.game, 'psychopath', s.characters)).toMatchObject({
				who: 'chosen',
				kills: true
			});
			expect(protection(s.game, s.seat('sailor'), s.characters, 'day')).toMatchObject({
				characterId: 'sailor'
			});
			expect(dayUseDeath(s.game, 'psychopath', s.seat('sailor'), s.characters)).toBe('maybe');
			const cause = validDeathCauses(s.game, s.seat('sailor'), s.characters, { day: true }).find(
				(c) => c.cause === 'psychopath'
			);
			expect(cause?.flags).toContainEqual(
				expect.objectContaining({
					code: 'protected-by-day',
					source: { characterId: 'sailor', seatId: s.seat('sailor') }
				})
			);
		});
		it('Example 2: Psychopath survives twice, then dies to roshambo', () => {
			// Wiki: "The Psychopath has been nominated by the Barber, and is executed. In Roshambo, the
			// Barber has rock and the Psychopath has rock, so the Psychopath lives. The next day, the
			// Saint nominates and executes the Psychopath. The Saint has paper and the Psychopath has
			// scissors, so the Psychopath lives. The next day, the Barber nominates and executes the
			// Psychopath again. The Barber has rock and the Psychopath has scissors, so the
			// Psychopath dies."
			// The Storyteller applies the roshambo result in the Execution sheet's Saved by.
			const s = scenario(['psychopath', 'barber', 'saint', 'chef', 'empath', 'imp']);
			expect(executionSavers(s.game, s.seat('psychopath'), s.characters)[0]).toEqual({
				source: { characterId: 'psychopath', seatId: s.seat('psychopath') }
			});
			const save = (at: typeof s) =>
				at.do({ type: 'Execute', seatId: at.seat('psychopath'), savedBy: 'psychopath' });
			const day1 = save(s.nominate('barber', 'psychopath'));
			expect(day1.game.seats[s.seat('psychopath')].dead).toBe(false);
			const day2 = save(day1.newDay().nominate('saint', 'psychopath'));
			expect(day2.game.seats[s.seat('psychopath')].dead).toBe(false);
			const day3 = day2.newDay().nominate('barber', 'psychopath').execute('psychopath');
			expect(day3.game.seats[s.seat('psychopath')].dead).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Psychopath#How_to_Run)', () => {
		const cast = ['psychopath', 'chef', 'empath', 'monk', 'imp'];
		const kill = (s: Scenario) =>
			({
				type: 'UseAbility',
				seatId: s.seat('psychopath'),
				characterId: 'psychopath',
				on: s.seat('monk')
			}) as const;

		it('kills the chosen player straight away, by the Psychopath', () => {
			// Wiki: "Once per day, before you have called for nominations, the Psychopath may publicly
			// choose a player. That player dies."
			const s = scenario(cast);
			expect(dayUseDeath(s.game, 'psychopath', s.seat('monk'), s.characters)).toBe('dies');
			const causes = validDeathCauses(s.game, s.seat('monk'), s.characters, { day: true });
			expect(causes.map((c) => c.cause)).toContain('psychopath');
		});

		it('may use the ability once each day, again the next day', () => {
			// Wiki: "Once per day, before you have called for nominations, the Psychopath may publicly
			// choose a player."
			const s = scenario(cast);
			const used = s.do(kill(s));
			expect(warned(used.session, used.ctx, kill(used))).toContain('already-used');
			const tomorrow = used.newDay();
			expect(warned(tomorrow.session, tomorrow.ctx, kill(tomorrow))).toEqual([]);
		});

		it('warns when the Psychopath kills after nominations were called', () => {
			// Wiki: "Once per day, before you have called for nominations, the Psychopath may publicly
			// choose a player."
			const s = scenario(cast).nominate('chef', 'empath');
			expect(warned(s.session, s.ctx, kill(s))).not.toEqual([]);
		});

		it('ends the day once the Psychopath is executed, whether they die or not', () => {
			// Wiki: "If the Psychopath draws or wins, they live. Either way, the day ends, since there is
			// only one execution per day."
			const s = scenario(cast)
				.nominate('chef', 'psychopath')
				.do((at) => ({ type: 'Execute', seatId: at.seat('psychopath'), savedBy: 'psychopath' }));
			expect(s.game.seats[s.seat('psychopath')].dead).toBe(false);
			expect(nominatorsAfterExecution(s.game, undefined, s.characters)).toEqual([]);
		});
	});
});
