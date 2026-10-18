/**
 * Mayor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mayor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mayor.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

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
		it.todo("Example 1: Imp's attack on Mayor bounces to Ravenkeeper");
		it('Example 2: Three alive and no execution: good wins', () => {
			const { session } = castGame(
				['mayor', 'chef', 'empath', 'baron', 'imp'],
				{ type: 'NewDay' },
				(s) => ({ type: 'SetDead', seatId: s[1], dead: true, cause: 'demon' }),
				(s) => ({ type: 'SetDead', seatId: s[2], dead: true, cause: 'demon' })
			);
			expect(gameEnds(session.game, testCharacters, { dayEnded: true })).toMatchObject([
				{ rule: 'mayor', winner: 'good' }
			]);
		});
		it.todo('Example 3: Tied vote spares everyone; good wins');
	});
});
