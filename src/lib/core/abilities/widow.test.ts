/**
 * Widow: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Widow
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Widow.
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
import { shownToSeats } from '#lib/core/rules/index.ts';
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

describe('Widow', () => {
	const character = committedCharacter('widow');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Widow');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('widow')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'signal', name: 'grimoire', time: 'night' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Widow#Examples)', () => {
		it.todo('Example 1: Widow poisons the Sailor for the whole game');
		it('Example 2: the good player marked Know is the one shown the Widow token', () => {
			// The Pit-Hag made a Widow; the Storyteller marks the Scapegoat Know, so the Scapegoat
			// is woken and shown the Widow token.
			const { game, seats } = table(['widow', 'scapegoat', 'chef', 'imp'], (seats) => ({
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'widow', label: 'Know' }
			}));
			expect(shownToSeats(game, 'widow', characters)).toEqual([seats[1]]);
		});

		it('shows the token to no one until a player is marked Know', () => {
			const { game } = table(['widow', 'chef', 'imp']);
			expect(shownToSeats(game, 'widow', characters)).toEqual([]);
		});
		it.todo("Example 3: Innkeeper briefly suspends Empath's poisoning");
	});
});
