/**
 * Al-Hadikhia: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Al-Hadikhia
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Al-Hadikhia.
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
import { killChoice, liveOrDieChosen, resolveLiveOrDie } from '#lib/core/rules/chosen-kills.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Al-Hadikhia', () => {
	const character = committedCharacter('alhadikhia');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Al-Hadikhia');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['1', '2', '3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('alhadikhia')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Al-Hadikhia#Examples)', () => {
		it('Example 1: Two chosen players die; the third lives', () => {
			// Wiki: "The Al-Hadikhia chooses Evin, Lachlan, and Sarah. Evin chooses to die. Lachlan chooses to
			// die. Sarah chooses to live. In the morning, Evin and Lachlan are dead, and Sarah is alive."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
				.reminder('chef', 'alhadikhia', '1')
				.reminder('empath', 'alhadikhia', '2')
				.reminder('monk', 'alhadikhia', '3');
			expect(killChoice('alhadikhia', s.characters)).toBe('live-or-die');
			const [evin, lachlan, sarah] = liveOrDieChosen(s.game, 'alhadikhia', s.characters);
			expect([evin, lachlan, sarah]).toEqual([s.seat('chef'), s.seat('empath'), s.seat('monk')]);
			const out = resolveLiveOrDie(s.game, [
				{ seatId: evin, lives: false },
				{ seatId: lachlan, lives: false },
				{ seatId: sarah, lives: true }
			]);
			expect(out.allDie).toBe(false);
			expect(out.results.map((r) => r.dead)).toEqual([true, true, false]);
		});

		it('Example 2: All three choose to live, so all die', () => {
			// Wiki: "The Al-Hadikhia chooses Alex, Lewis, and Doug, who is dead. Alex chooses life. Lewis
			// chooses life. Doug chooses life, so is now alive. Since all players are now alive, all three
			// players die."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
				.dies('monk')
				.reminder('chef', 'alhadikhia', '1')
				.reminder('empath', 'alhadikhia', '2')
				.reminder('monk', 'alhadikhia', '3');
			expect(s.game.seats[s.seat('monk')].dead).toBe(true);
			const chosen = liveOrDieChosen(s.game, 'alhadikhia', s.characters);
			const out = resolveLiveOrDie(
				s.game,
				chosen.map((seatId) => ({ seatId, lives: true }))
			);
			expect(out.allDie).toBe(true);
			// Doug came back to life, then died with the others: a new death tonight.
			expect(out.results.map((r) => [r.dead, r.died, r.revived])).toEqual([
				[true, true, false],
				[true, true, false],
				[true, true, false]
			]);
		});
	});
});
