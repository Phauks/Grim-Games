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
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
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
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'baron', 'leviathan'])
				.newDay()
				.execute('chef')
				.newDay()
				.execute('empath');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'executions-of-alignment', winner: 'evil' }
			]);
		});
		it.todo('Example 2: Two evil executed, then one good');
	});
});
