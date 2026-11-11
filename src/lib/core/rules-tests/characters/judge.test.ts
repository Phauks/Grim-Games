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
import { dayUseSuggestion, dayUseWho } from '#lib/core/rules/day/day-claims.ts';
import { isExecution } from '#lib/core/rules/abilities/death-causes.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { executionOutcomes } from '#lib/core/rules/day/execution-outcome.ts';

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

		it("Example 1: Judge stops Po's execution; Slayer remains doomed", () => {
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
			// The Po's execution fails: nobody is executed, so the Slayer stays about to die. Votes are
			// counted outside the app (Trevor, 2026-11-01), so who is about to die is the Storyteller's.
			const failed = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('po'),
				outcome: { kind: 'failed', characterId: 'judge' }
			}));
			expect(failed.game.seats[failed.seat('po')].dead).toBe(false);
			const kinds = failed.game.today.entries.map((e) => e.kind);
			expect(kinds.at(-1)).toBe('execution-failed');
			expect(kinds).not.toContain('execution');
			expect(failed.game.seats[failed.seat('judge')].reminders).toMatchObject([
				{ characterId: 'judge', label: 'No Ability' }
			]);
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Judge#How_to_Run)', () => {
		const cast = ['judge', 'chef', 'empath', 'monk', 'goon', 'imp'];

		it('may rule on the latest nomination, until another player is nominated', () => {
			// Wiki: "At any time during a nomination for execution—from the moment that the nomination
			// is declared to the moment before a new player is nominated for execution—the Judge can
			// declare that this execution succeeds or fails."
			const s = scenario(cast).newDay().nominate('chef', 'goon');
			expect(dayUseSuggestion(s.game, s.seat('judge'), 'nominee')).toBe(s.seat('goon'));
			expect(executionOutcomes(s.game, s.seat('goon'), s.characters)).toEqual([
				{ kind: 'force', characterId: 'judge', seatId: s.seat('judge'), works: true }
			]);
			const next = s.nominate('empath', 'monk');
			expect(dayUseSuggestion(next.game, next.seat('judge'), 'nominee')).toBe(next.seat('monk'));
		});

		it('executes the nominee when the Judge says the execution succeeds', () => {
			// Wiki: "If the Judge declares that it succeeds, the nominated player is executed and you
			// may proceed to the night phase (as there may only be one execution per day)."
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'goon')
				.do((at) => ({
					type: 'Execute',
					seatId: at.seat('goon'),
					outcome: { kind: 'forced', characterId: 'judge' }
				}));
			expect(s.game.seats[s.seat('goon')].dead).toBe(true);
			expect(s.game.today.entries.at(-1)).toMatchObject({
				kind: 'execution',
				seatId: s.seat('goon'),
				forcedBy: { characterId: 'judge' }
			});
		});

		it('logs a failed execution as no execution, and nominations go on', () => {
			// Wiki: "If the Judge declares that it fails, the nominated player is no longer about to
			// die and they are treated as receiving zero votes for execution, and the nomination
			// process continues."
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'goon')
				.do((at) => ({
					type: 'Execute',
					seatId: at.seat('goon'),
					outcome: { kind: 'failed', characterId: 'judge' }
				}))
				.nominate('empath', 'monk')
				.execute('monk');
			expect(s.game.seats[s.seat('goon')].dead).toBe(false);
			expect(s.game.seats[s.seat('monk')].dead).toBe(true);
		});

		it('marks the Judge No Ability, after which a ruling is flagged as used', () => {
			// Wiki: "The Judge loses their ability—put the Judge’s NO ABILITY reminder token by the
			// Judge token."
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'goon')
				.do((at) => ({
					type: 'Execute',
					seatId: at.seat('goon'),
					outcome: { kind: 'forced', characterId: 'judge' }
				}));
			expect(s.game.seats[s.seat('judge')].reminders).toMatchObject([
				{ characterId: 'judge', label: 'No Ability' }
			]);
			const later = s.newDay().nominate('empath', 'monk');
			expect(executionOutcomes(later.game, later.seat('monk'), later.characters)).toMatchObject([
				{ characterId: 'judge', problem: 'used' }
			]);
		});
	});
});
