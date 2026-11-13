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
import {
	killChoice,
	liveOrDieChosen,
	resolveLiveOrDie
} from '#lib/core/rules/night/chosen-kills.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day/day-reminders.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
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
			expect(killChoice(s.game, 'alhadikhia', s.characters)).toBe('live-or-die');
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Al-Hadikhia#How_to_Run)', () => {
		it('the 1, 2 and 3 reminders may go on any player, alive or dead', () => {
			// Wiki: "Each night except the first, wake the Al-Hadikhia. They may point at three players.
			// If they do, mark these players with the 1, 2 and 3 reminders, in the order the
			// Al-Hadikhia chose."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner']).dies(
				'monk',
				'alhadikhia'
			);
			for (const label of ['1', '2', '3'])
				for (const seatId of s.game.seating)
					expect(
						reminderTargetMisses(s.game, { characterId: 'alhadikhia', label }, seatId, s.characters)
					).toEqual([]);
		});

		it('asks the chosen players in the order of their reminders', () => {
			// Wiki: "Wake the player marked 1 and say “The Al-Hadikhia has chosen” then the name of the
			// player, then “Do you choose to live?” They either nod or shake their head. Put them to
			// sleep."
			// Wiki: "Repeat for players marked 2 then 3."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
				.reminder('chef', 'alhadikhia', '3')
				.reminder('empath', 'alhadikhia', '1')
				.reminder('monk', 'alhadikhia', '2');
			expect(liveOrDieChosen(s.game, 'alhadikhia', s.characters)).toEqual([
				s.seat('empath'),
				s.seat('monk'),
				s.seat('chef')
			]);
		});

		it('a dead player who chooses to live comes back, and a living one who chooses to die dies', () => {
			// Wiki: "If they chose to live, remove their shroud (if any), and if they choose to die,
			// add a shroud."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
				.dies('monk', 'alhadikhia')
				.reminder('chef', 'alhadikhia', '1')
				.reminder('empath', 'alhadikhia', '2')
				.reminder('monk', 'alhadikhia', '3');
			const out = resolveLiveOrDie(s.game, [
				{ seatId: s.seat('chef'), lives: false },
				{ seatId: s.seat('empath'), lives: true },
				{ seatId: s.seat('monk'), lives: true }
			]);
			expect(out.allDie).toBe(false);
			expect(out.results.map((r) => [r.dead, r.died, r.revived])).toEqual([
				[true, true, false],
				[false, false, false],
				[false, false, true]
			]);
		});

		it('reminds the Storyteller at dawn to say which marked players are alive', () => {
			// Wiki: "Each dawn, declare which players marked 1, 2 and 3 are alive and which are dead. Do
			// this even if a player’s alive or dead status did not change during the night."
			const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
				.reminder('chef', 'alhadikhia', '1')
				.reminder('empath', 'alhadikhia', '2')
				.reminder('monk', 'alhadikhia', '3')
				.newDay();
			const lines = dayReminders(
				dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
			).groups.flatMap((g) => g.reminders.filter((r) => r.characterId === 'alhadikhia'));
			expect(lines.length).toBeGreaterThan(0);
		});
	});
});
