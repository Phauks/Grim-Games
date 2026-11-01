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
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';

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
			// The Mayor survives the Imp's attack, which the Storyteller may move onto another player.
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
			const s = scenario(['mayor', 'chef', 'empath', 'baron', 'imp'])
				.newDay()
				.dies('chef', 'demon')
				.dies('empath', 'demon');
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'alive-at-dusk', winner: 'good' }
			]);
		});
		it('Example 3: Tied vote spares everyone; good wins', () => {
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
});
