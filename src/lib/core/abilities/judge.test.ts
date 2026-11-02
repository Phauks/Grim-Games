/**
 * Judge: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Judge
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Judge.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { dayUseSuggestion, dayUseWho } from '#lib/core/rules/day-claims.ts';
import { isExecution } from '#lib/core/rules/death-causes.ts';
import { engineGap, scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Judge', () => {
	const character = committedCharacter('judge');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Judge');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('judge')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Judge#Examples)', () => {
		/** The nominee whose execution the Judge may decide now, if any. */
		const judged = (s: Scenario) => dayUseSuggestion(s.game, s.seat('judge'), 'nominee');

		it.fails("Example 1: Judge stops Po's execution; Slayer remains doomed", () => {
			// Wiki: "The Slayer was about to die, but the Po is nominated and every alive player votes,
			// so now the Po is about to die. The evil Judge decides that the Po’s execution fails. So,
			// as before, the Slayer is about to die, and the nomination process continues."
			const s = scenario(['judge', 'slayer', 'chef', 'empath', 'monk', 'po'])
				.becomes('judge', 'judge', 'evil')
				.newDay()
				.nominate('chef', 'slayer')
				.nominate('empath', 'po');
			expect(dayUseWho('judge', s.characters)).toBe('nominee');
			expect(judged(s)).toBe(s.seat('po'));
			const used = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('judge'),
				characterId: 'judge',
				on: at.seat('po')
			}));
			expect(used.game.seats[used.seat('judge')].reminders).toMatchObject([
				{ characterId: 'judge', label: 'No Ability' }
			]);
			engineGap(
				'M9',
				'who is about to die: a vote the Judge made fail leaves the Slayer about to die, not the Po'
			);
		});
		it("Example 2: Judge forces Goon's execution after Grandmother's nomination", () => {
			// Wiki: "The good Judge nominates the Professor. Nobody votes, but the Judge may not use
			// their ability. A Traveller's exile is voted on. Once again, the Judge may not use their
			// ability. The Grandmother nominates the Goon. Even though the Goon got only one vote, the
			// Judge decides that the Goon is executed immediately."
			const s = scenario(['judge', 'professor', 'grandmother', 'goon', 'gunslinger', 'imp'])
				.becomes('judge', 'judge', 'good')
				.becomes('gunslinger', 'gunslinger', 'evil')
				.newDay()
				.nominate('judge', 'professor');
			// Only another player's nomination counts.
			expect(judged(s)).toBeUndefined();
			const exile = s.do((at) => ({ type: 'Exile', seatId: at.seat('gunslinger') }));
			expect(judged(exile)).toBeUndefined();
			const goon = exile.nominate('grandmother', 'goon');
			expect(judged(goon)).toBe(goon.seat('goon'));
			const executed = goon.execute('goon');
			expect(executed.game.seats[executed.seat('goon')].dead).toBe(true);
			expect(isExecution(executed.game.seats[executed.seat('goon')].deathCause, s.characters)).toBe(
				true
			);
		});
	});
});
