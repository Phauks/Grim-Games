/**
 * Damsel: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Damsel
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Damsel.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { shownAtMinionInfo, shownToSeats } from '#lib/core/rules/index.ts';
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

describe('Damsel', () => {
	const character = committedCharacter('damsel');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Damsel');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Guess Used']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('damsel')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Damsel#Examples)', () => {
		it.todo('Example 1: Witch names bluffing Damsel; evil wins');
		it.todo('Example 2: Two wrong Minion guesses change nothing');
	});

	// "All Minions know a Damsel is in play": each Minion is shown the Damsel token, at Minion
	// info (https://wiki.bloodontheclocktower.com/Damsel).
	describe('Minions are shown the Damsel token', () => {
		it('wakes every Minion, and is one of the cards at Minion info', () => {
			const { game, seats } = table(['damsel', 'poisoner', 'spy', 'imp', 'chef']);
			expect(shownToSeats(game, 'damsel', characters)).toEqual([seats[1], seats[2]]);
			expect(shownAtMinionInfo(game, characters)).toEqual(['damsel']);
		});

		it('is not a card at Minion info without a Damsel in play', () => {
			const { game } = table(['poisoner', 'imp', 'chef']);
			expect(shownAtMinionInfo(game, characters)).toEqual([]);
		});
	});
});
