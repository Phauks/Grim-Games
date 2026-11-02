/**
 * Leviathan: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Leviathan
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Leviathan.
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

describe('Leviathan', () => {
	const character = committedCharacter('leviathan');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Leviathan');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([
				'Day 1',
				'Day 2',
				'Day 3',
				'Day 4',
				'Day 5',
				'Good Player Executed'
			]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('leviathan')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Leviathan#Examples)', () => {
		it('Example 1: Two good players executed early, so evil wins', () => {
			// Wiki: "On the first day, the Monk nominates the Virgin, and is executed. On the second day,
			// the Courtier is executed. Evil wins."
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'baron', 'leviathan'])
				.newDay()
				.execute('chef')
				.newDay()
				.execute('empath');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'executions-of-alignment', winner: 'evil' }
			]);
		});
		it('Example 2: Two evil executed, then one good', () => {
			// Wiki: "On the second day, the Scarlet Woman is executed. On the third day, the Poisoner is
			// executed. On the fifth day, the Soldier is executed. Evil wins."
			// One good player executed is not enough; the Leviathan is alive at the end of day 5.
			const s = scenario([
				'leviathan',
				'scarletwoman',
				'poisoner',
				'soldier',
				'chef',
				'empath',
				'monk',
				'mayor'
			])
				.newDay()
				.newDay()
				.execute('scarletwoman')
				.newDay()
				.execute('poisoner')
				.newDay()
				.newDay()
				.execute('soldier');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'survives-day', day: 5, winner: 'evil' }
			]);
		});
	});
});
