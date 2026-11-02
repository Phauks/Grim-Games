/**
 * Organ Grinder: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Organ_Grinder
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Organ Grinder.
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
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Organ Grinder', () => {
	const character = committedCharacter('organgrinder');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Organ Grinder');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['About To Die', 'Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('organgrinder')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'vote', name: 'hidden' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Organ_Grinder#Examples)', () => {
		it.fails('Example 1: Secret votes, Imp executed, good wins', () => {
			// Wiki: "There are 8 players alive. The Noble is nominated. All players close eyes to vote and
			// the Noble gets 5 votes. The Imp is nominated. All players close eyes to vote and the Imp
			// gets 7 votes. The Pixie is nominated. All players close eyes to vote and the Pixie gets 4
			// votes. After nominations close, the Storyteller declares that Doug (the Imp) is executed and
			// dies, and that good has won."
			const s = scenario([
				'organgrinder',
				'noble',
				'imp',
				'pixie',
				'chef',
				'empath',
				'monk',
				'mayor'
			])
				.newDay()
				.nominate('chef', 'noble')
				.nominate('empath', 'imp')
				.nominate('monk', 'pixie')
				.execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
			engineGap(
				'M9',
				'while the Organ Grinder is sober, votes are cast with eyes closed and each tally (5, 7, 4) is hidden until nominations close'
			);
		});
	});
});
