/**
 * Apprentice: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Apprentice
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Apprentice.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { isTraveller, trueCharacter } from '#lib/core/model/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { validDeathCauses } from '#lib/core/rules/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Apprentice', () => {
	const character = committedCharacter('apprentice');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Apprentice');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Is The Apprentice']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('apprentice')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'signal', name: 'grimoire', time: 'night' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Apprentice#Examples)', () => {
		it.todo('Example 1: Evil Apprentice gets Assassin, kills Fool');
		it.todo('Example 2: Wrong Tea Lady guess kills the Gambler');
	});

	// The Storyteller swaps the Apprentice's token for the gained character and marks it
	// "Is The Apprentice" (Trevor, 2026-10-16): the seat shows the Monk, the player is the
	// Apprentice, a Traveller.
	describe('a swapped token marked "Is The Apprentice"', () => {
		function apprenticeAsMonk() {
			const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat']);
			const s = run(
				session,
				ctx,
				...[
					['monk', 'good'],
					['imp', undefined],
					['chef', undefined]
				].map(([characterId, alignment], i): Command => ({
					type: 'AssignCharacter',
					seatId: seats[i],
					characterId: characterId!,
					...(alignment ? { alignment: alignment as 'good' } : {})
				})),
				{
					type: 'AddReminder',
					seatId: seats[0],
					reminder: { characterId: 'apprentice', label: 'Is The Apprentice' }
				}
			);
			return { game: s.game, seats };
		}

		it('is really the Apprentice, a Traveller', () => {
			const { game, seats } = apprenticeAsMonk();
			expect(game.seats[seats[0]].characterId).toBe('monk');
			expect(trueCharacter(game, seats[0], characters)).toBe('apprentice');
			expect(isTraveller(game, seats[0], characters)).toBe(true);
		});

		it('is exiled, not executed', () => {
			const { game, seats } = apprenticeAsMonk();
			expect(validDeathCauses(game, seats[0], characters)[0].cause).toBe('exile');
		});
	});
});
