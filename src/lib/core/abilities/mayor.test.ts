/**
 * Mayor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mayor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mayor.
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
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';

describe('Mayor', () => {
	const character = committedCharacter('mayor');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Mayor');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('mayor')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mayor#Examples)', () => {
		it("Example 1: Imp's attack on Mayor bounces to Ravenkeeper", () => {
			// Wiki: "The Imp attacks the Mayor. The Storyteller chooses that the Ravenkeeper dies
			// instead."
			const s = scenario(['mayor', 'ravenkeeper', 'imp', 'chef', 'poisoner']).reminder(
				'mayor',
				'imp',
				'Dead'
			);
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					seatId: s.seat('mayor'),
					because: [{ kind: 'may-bounce', source: { characterId: 'mayor' } }]
				}
			]);
		});
		it('Example 2: Three alive and no execution: good wins', () => {
			// Wiki: "There are three players alive. There are no nominations for execution today. Good
			// wins."
			const s = scenario(['mayor', 'chef', 'empath', 'baron', 'imp'])
				.newDay()
				.dies('chef', 'demon')
				.dies('empath', 'demon');
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'alive-at-dusk', winner: 'good' }
			]);
		});
		it('Example 3: Tied vote spares everyone; good wins', () => {
			// Wiki: "There are five players alive, including two Travellers. Both Travellers are exiled,
			// and the vote is tied between the remaining players. Because a tied vote means neither player
			// is executed, good wins."
			// Five alive, two of them Travellers: both are exiled, and the tied vote executes nobody.
			// Exile is not execution, so with three alive and no execution good wins.
			const s = scenario(['mayor', 'chef', 'imp', 'beggar', 'gunslinger'])
				.do(
					(at) => ({ type: 'SetAlignment', seatId: at.seat('beggar'), alignment: 'good' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'evil' })
				)
				.newDay()
				.do((at) => ({ type: 'Exile', seatId: at.seat('beggar') }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('gunslinger') }));
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'alive-at-dusk', winner: 'good' }
			]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Mayor#How_to_Run)', () => {
		it("flags that the Mayor's death may bounce on the Demon's night step", () => {
			// How to Run: if the Mayor would die at night, the Storyteller picks whether they die or
			// someone else dies in their place.
			const s = scenario(['mayor', 'ravenkeeper', 'imp', 'chef', 'poisoner']);
			expect(nightStepAlerts(s.game, 'imp', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'may-bounce',
					seatId: s.seat('mayor'),
					source: expect.objectContaining({ characterId: 'mayor' }),
					works: true
				})
			);
		});

		it("marks the player who dies instead with the Demon's Dead reminder", () => {
			// How to Run: the Demon's Dead reminder and the shroud go on the other player, not the
			// Mayor, who stays alive and unmarked.
			const s = scenario(['mayor', 'ravenkeeper', 'imp', 'chef', 'poisoner'])
				.reminder('ravenkeeper', 'imp', 'Dead')
				.dies('ravenkeeper', 'demon');
			expect(preventedDeaths(s.game, s.characters)).toEqual([]);
			expect(s.game.seats[s.seat('mayor')].dead).toBe(false);
			expect(
				validDeathCauses(s.game, s.seat('ravenkeeper'), s.characters).map((c) => c.cause)
			).toContain('demon');
		});

		it('gives no win at dusk on a day with an execution', () => {
			// How to Run: good wins at dusk only with exactly three alive and nobody executed today.
			const s = scenario(['mayor', 'chef', 'empath', 'baron', 'imp'])
				.newDay()
				.dies('chef', 'demon')
				.execute('empath');
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toEqual([]);
		});

		it('gives the win only once the day ends', () => {
			// How to Run: the check is made at dusk.
			const s = scenario(['mayor', 'chef', 'empath', 'baron', 'imp'])
				.newDay()
				.dies('chef', 'demon')
				.dies('empath', 'demon');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
	});
});
