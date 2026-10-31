/**
 * Storm Catcher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Storm_Catcher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Storm Catcher.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { evilLearns } from '#lib/core/rules/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/** Seats with these characters, then the extra commands. */
function table(ids: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(ids.map((_, i) => `P${i}`));
	const s = run(
		session,
		ctx,
		...ids.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((command) => command(seats))
	);
	return { game: s.game, seats };
}

describe('Storm Catcher', () => {
	const character = committedCharacter('stormcatcher');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Storm Catcher');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Stormcaught']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('stormcatcher')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Storm_Catcher#Examples)', () => {
		it.todo('Example 1: General survives night attacks until executed');

		it('Example 1: the evil players learn who the favoured General is', () => {
			// The General is marked Stormcaught: the Imp and Godfather are shown "This player is"
			// with the General, pointing at its player.
			const { game, seats } = table(['general', 'imp', 'godfather', 'chef'], (seats) => ({
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'stormcatcher', label: 'Stormcaught' }
			}));
			expect(evilLearns(game, 'stormcatcher', characters)).toEqual({
				evil: [seats[1], seats[2]],
				marked: { seatId: seats[0], characterId: 'general' }
			});
		});

		it('Example 2: with the favoured Empath not in play, no one is marked', () => {
			// The evil players are shown the Empath as not in play, so the Poisoner may bluff it.
			const { game, seats } = table(['poisoner', 'imp', 'chef']);
			expect(evilLearns(game, 'stormcatcher', characters)).toEqual({
				evil: [seats[0], seats[1]]
			});
		});
	});
});
