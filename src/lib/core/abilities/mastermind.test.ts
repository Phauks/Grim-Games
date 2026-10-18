/**
 * Mastermind: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mastermind
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mastermind.
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

describe('Mastermind', () => {
	const character = committedCharacter('mastermind');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Mastermind');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('mastermind')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mastermind#Examples)', () => {
		it('Example 1: Demon dead, good player executed: evil wins', () => {
			const { session } = castGame(
				['professor', 'chef', 'empath', 'mastermind', 'shabaloth'],
				{ type: 'NewDay' },
				(s) => ({ type: 'Execute', seatId: s[4] }),
				{ type: 'NewDay' },
				(s) => ({ type: 'Execute', seatId: s[0] })
			);
			expect(gameEnds(session.game, testCharacters)).toMatchObject([
				{ rule: 'mastermind', winner: 'evil' }
			]);
		});
		it.todo('Example 2: Protected evil player executed; good wins anyway');
		it.todo("Example 3: Zombuul's second death extends the game a day");
		it('Example 4: Two alive, no execution: good wins', () => {
			const { session } = castGame(
				['chef', 'empath', 'mastermind', 'imp'],
				(s) => ({ type: 'SetDead', seatId: s[1], dead: true, cause: 'demon' }),
				{ type: 'NewDay' },
				(s) => ({ type: 'Execute', seatId: s[3] }),
				{ type: 'NewDay' }
			);
			expect(gameEnds(session.game, testCharacters, { dayEnded: true })).toMatchObject([
				{ rule: 'mastermind', winner: 'good' }
			]);
		});
	});
});
