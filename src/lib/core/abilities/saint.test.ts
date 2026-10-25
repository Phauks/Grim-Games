/**
 * Saint: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Saint
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Saint.
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

describe('Saint', () => {
	const character = committedCharacter('saint');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Saint');
			expect(character.type).toBe('outsider');
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
			expect(nightSheetPresence('saint')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Saint#Examples)', () => {
		it('Example 1: Saint executed, so evil wins', () => {
			const { session } = castGame(['saint', 'chef', 'empath', 'baron', 'imp'], (s) => ({
				type: 'Execute',
				seatId: s[0]
			}));
			expect(gameEnds(session.game, testCharacters)).toMatchObject([
				{ rule: 'executed-loses', winner: 'evil' }
			]);
		});
		it('Example 2: Gunslinger kills Saint; game continues', () => {
			const { session } = castGame(
				['saint', 'chef', 'empath', 'baron', 'imp', 'gunslinger'],
				(s) => ({
					type: 'SetDead',
					seatId: s[0],
					dead: true,
					cause: 'gunslinger'
				})
			);
			expect(gameEnds(session.game, testCharacters)).toEqual([]);
		});
		it.todo("Example 3: Scapegoat dies in Saint's place; game continues");
	});
});
