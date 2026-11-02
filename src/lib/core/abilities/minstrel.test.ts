/**
 * Minstrel: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Minstrel
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Minstrel.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { isTraveller } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { isExecution } from '#lib/core/rules/death-causes.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Minstrel', () => {
	const character = committedCharacter('minstrel');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Minstrel');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Everyone Is Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('minstrel')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Minstrel#Examples)', () => {
		/** The Storyteller marks the Minstrel's Everyone Is Drunk, after a Minion's execution. */
		const drunk = (s: Scenario) => s.reminder('minstrel', 'minstrel', 'Everyone Is Drunk');
		/** Dusk the next day: the token comes off. */
		const sober = (s: Scenario) => {
			const token = s.game.seats[s.seat('minstrel')].reminders.find(
				(r) => r.label === 'Everyone Is Drunk'
			)!;
			return s.do({ type: 'RemoveReminder', reminderId: token.reminderId });
		};
		/** The Everyone Is Drunk tokens on the Minstrel. */
		const drunkTokens = (s: Scenario) =>
			s.game.seats[s.seat('minstrel')].reminders.filter((r) => r.label === 'Everyone Is Drunk');
		const works = (s: Scenario, on: SeatRef) =>
			abilityState(s.game, s.seat(on), s.characters).works;

		it('Example 1: Minion executed: everyone drunk next day', () => {
			// Wiki: "During the first day, the Pacifist dies. That night, players act as normal,
			// because the Pacifist is not a Minion. During the second day, the Judge executes the
			// Godfather. That night, everyone is drunk, including the Demon, so nobody dies. During the
			// third day, a Minion who is protected by the Devil's Advocate is executed and dies,
			// because the Devil's Advocate is drunk. Again, since a Minion died during the day, the
			// Minstrel makes everyone drunk."
			const cast = ['minstrel', 'pacifist', 'judge', 'godfather', 'devilsadvocate', 'chef', 'imp'];
			const day1 = scenario(cast).becomes('judge', 'judge', 'good').newDay().execute('pacifist');
			// A Townsfolk's execution: no Everyone Is Drunk.
			expect(drunkTokens(day1)).toEqual([]);
			expect(works(day1, 'imp')).toBe(true);
			// The Godfather's execution puts it on by itself.
			const day2 = day1.newDay().execute('godfather');
			expect(drunkTokens(day2)).toHaveLength(1);
			expect(works(day2, 'imp')).toBe(false);
			expect(works(day2, 'judge')).toBe(true);
			// The next day, still before dusk: the Devil's Advocate's protection fails.
			const day3 = day2
				.newDay()
				.reminder('devilsadvocate', 'devilsadvocate', 'Survives Execution')
				.execute('devilsadvocate');
			expect(day3.game.seats[day3.seat('devilsadvocate')].dead).toBe(true);
			// A Minion died by execution again: everyone stays drunk, one token still.
			expect(drunkTokens(day3)).toHaveLength(1);
		});
		it("Example 2: Traveller exile doesn't trigger; everyone sobers", () => {
			// Wiki: "The Assassin is executed, so the Minstrel makes everyone drunk. The next day, the
			// Godfather is executed, so the Minstrel makes everyone drunk again. The Demon could not
			// kill on either night. The next day, the evil Apprentice Mastermind is exiled, so that
			// night everyone becomes sober again, because the Minstrel ability doesn't trigger from a
			// Traveller being exiled."
			const cast = ['minstrel', 'assassin', 'godfather', 'apprentice', 'chef', 'empath', 'imp'];
			const s = scenario(cast)
				.becomes('apprentice', 'mastermind', 'evil')
				.reminder('apprentice', 'apprentice', 'Is The Apprentice');
			const night1 = s.newDay().execute('assassin');
			expect(works(night1, 'imp')).toBe(false);
			const night2 = sober(night1).newDay().execute('godfather');
			expect(works(night2, 'imp')).toBe(false);
			// A Traveller, holding a Minion's ability, is exiled: not an execution.
			const day3 = sober(night2)
				.newDay()
				.do((at) => ({ type: 'Exile', seatId: at.seat('apprentice') }));
			expect(isTraveller(day3.game, day3.seat('apprentice'), day3.characters)).toBe(true);
			expect(
				isExecution(day3.game.seats[day3.seat('apprentice')].deathCause, day3.characters)
			).toBe(false);
			expect(drunkTokens(day3)).toEqual([]);
			expect(works(day3, 'imp')).toBe(true);
		});
		it('Example 3: Good wins when drunk Zombuul dies', () => {
			// Wiki: "During the day, the Assassin dies, so the Minstrel makes everyone drunk. The
			// following day, the Zombuul is executed and dies for the first time. Good wins, because
			// the Zombuul is drunk and so has no ability."
			const s = drunk(
				scenario(['minstrel', 'assassin', 'chef', 'empath', 'zombuul']).newDay().execute('assassin')
			)
				.newDay()
				.execute('zombuul');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good', holds: [] }
			]);
		});
	});
});
