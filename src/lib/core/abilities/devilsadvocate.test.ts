/**
 * Devil's Advocate: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Devil%27s_Advocate
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Devil's Advocate.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { gameEnds, livesWhileDead } from '#lib/core/rules/game-end.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe("Devil's Advocate", () => {
	const character = committedCharacter('devilsadvocate');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe("Devil's Advocate");
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Survives Execution']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('devilsadvocate')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Devil%27s_Advocate#Examples)', () => {
		/** Today's executions in the day log. */
		const executions = (s: Scenario) => s.game.today.entries.filter((e) => e.kind === 'execution');
		/** The Devil's Advocate's choice tonight, taken off any earlier choice. */
		const protect = (s: Scenario, on: SeatRef) => {
			const earlier = s.game.seating.flatMap((id) =>
				s.game.seats[id].reminders.filter((r) => r.characterId === 'devilsadvocate')
			);
			return earlier
				.reduce<Scenario>((at, r) => at.do({ type: 'RemoveReminder', reminderId: r.reminderId }), s)
				.reminder(on, 'devilsadvocate', 'Survives Execution');
		};

		it("Example 1: Devil's Advocate protects themself, survives execution", () => {
			// Wiki: "At night, the Devil's Advocate protects themself. The next day, the Devil's
			// Advocate is executed but remains alive."
			const s = protect(
				scenario(['devilsadvocate', 'chef', 'empath', 'monk', 'imp']),
				'devilsadvocate'
			)
				.newDay()
				.execute('devilsadvocate');
			expect(s.game.seats[s.seat('devilsadvocate')].dead).toBe(false);
			expect(executions(s)).toMatchObject([
				{ died: false, savedBy: { characterId: 'devilsadvocate' } }
			]);
		});
		it('Example 2: Protected Zombuul survives one execution, then dies', () => {
			// Wiki: "The Devil's Advocate protects the Zombuul. The Zombuul is executed but remains
			// alive, so their life token is not flipped. The next day, the Zombuul is executed again
			// and registers as dead."
			const cast = ['devilsadvocate', 'chef', 'empath', 'monk', 'zombuul'];
			const s = protect(scenario(cast), 'zombuul').newDay().execute('zombuul');
			expect(s.game.seats[s.seat('zombuul')].dead).toBe(false);
			expect(executions(s)).toMatchObject([{ died: false }]);
			// The next night the Devil's Advocate chooses someone else.
			const again = protect(s, 'chef').newDay().execute('zombuul');
			expect(again.game.seats[again.seat('zombuul')].dead).toBe(true);
			// The Zombuul's first death: it lives on, so good has not won.
			expect(livesWhileDead(again.game, again.seat('zombuul'), again.characters)).toBe(true);
			expect(gameEnds(again.game, again.characters)).toEqual([]);
		});
		it('Example 3: Protects several players with mixed outcomes', () => {
			// Wiki: "The Devil's Advocate protects the Grandmother. The Grandmother is executed but
			// remains alive. Later, the Devil's Advocate protects the Tinker. The Tinker is executed,
			// but the Storyteller kills the Tinker anyway, due to the Tinker ability. Later, the
			// Devil's Advocate protects the Moonchild, and the Judge forces the execution to
			// succeed—the execution succeeds, but the Moonchild remains alive."
			const cast = ['devilsadvocate', 'grandmother', 'tinker', 'moonchild', 'judge', 'chef', 'imp'];
			const s = protect(scenario(cast), 'grandmother').newDay().execute('grandmother');
			expect(s.game.seats[s.seat('grandmother')].dead).toBe(false);

			const tinker = protect(s, 'tinker').newDay().execute('tinker');
			expect(tinker.game.seats[tinker.seat('tinker')].dead).toBe(false);
			const killed = tinker.dies('tinker', 'tinker');
			expect(killed.game.seats[killed.seat('tinker')]).toMatchObject({
				dead: true,
				deathCause: 'tinker'
			});

			// The Judge's forced execution is still an execution, and the Moonchild still survives.
			const moonchild = protect(killed, 'moonchild')
				.newDay()
				.do((at) => ({ type: 'UseAbility', seatId: at.seat('judge'), characterId: 'judge' }))
				.execute('moonchild');
			expect(moonchild.game.seats[moonchild.seat('moonchild')].dead).toBe(false);
			expect(executions(moonchild)).toMatchObject([
				{ seatId: moonchild.seat('moonchild'), died: false }
			]);
		});
	});
});
