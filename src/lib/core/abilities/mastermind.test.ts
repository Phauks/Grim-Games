/**
 * Mastermind: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mastermind
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mastermind.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Mastermind', () => {
	const character = committedCharacter('mastermind');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Mastermind');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
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
			expect(nightSheetPresence('mastermind')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mastermind#Examples)', () => {
		it('Example 1: Demon dead, good player executed: evil wins', () => {
			// Wiki: "The Shabaloth dies. The next day, the Professor is executed and dies. Evil wins."
			const s = scenario(['professor', 'chef', 'empath', 'mastermind', 'shabaloth'])
				.newDay()
				.execute('shabaloth')
				.newDay()
				.execute('professor');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ rule: 'extra-day', winner: 'evil' }]);
		});
		it('Example 2: Protected evil player executed; good wins anyway', () => {
			// Wiki: "The Po dies. The next day, the Godfather is executed, but remains alive because
			// they were protected by the Devil's Advocate. However, since an evil player was executed,
			// good wins."
			// The Po died by execution, so the Mastermind's extra day follows.
			const s = scenario(['chef', 'empath', 'devilsadvocate', 'godfather', 'mastermind', 'po'])
				.newDay()
				.execute('po')
				.newDay()
				.reminder('godfather', 'devilsadvocate', 'Survives Execution')
				.execute('godfather');
			expect(s.game.seats[s.seat('godfather')].dead).toBe(false);
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'extra-day', winner: 'good', seats: [s.seat('godfather')] }
			]);
		});
		it("Example 3: Zombuul's second death extends the game a day", () => {
			// Wiki: "The Zombuul is executed and appears to die. The Mastermind’s ability does not
			// trigger yet, because the Zombuul's execution did not make the game end. When the Zombuul
			// is executed a second time and dies for real, the Mastermind’s ability triggers, and the
			// game continues for one more day."
			const first = scenario(['chef', 'empath', 'monk', 'mastermind', 'zombuul'])
				.newDay()
				.execute('zombuul');
			expect(gameEnds(first.game, first.characters)).toEqual([]);
			const second = first
				.newDay()
				.newDay()
				.execute('zombuul')
				.reminder('zombuul', 'zombuul', 'Dead');
			expect(gameEnds(second.game, second.characters)).toMatchObject([
				{ rule: 'demon-dead', holds: [{ rule: 'extra-day', characterId: 'mastermind' }] }
			]);
		});
		it('Example 4: Two alive, no execution: good wins', () => {
			// Wiki: "There are three players alive. The Demon dies. The following day, with just two
			// players alive, good decides not to execute. When night falls, just two players are left
			// alive but the Demon is dead, so good wins."
			const s = scenario(['chef', 'empath', 'mastermind', 'imp'])
				.dies('empath', 'demon')
				.newDay()
				.execute('imp')
				.newDay();
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'extra-day', winner: 'good' }
			]);
		});
	});
});
