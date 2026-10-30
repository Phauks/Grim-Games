/**
 * Amnesiac: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Amnesiac
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Amnesiac.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment, type CharacterId } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castWith } from '#lib/core/model/fixtures.test-support.ts';
import {
	abilityGivers,
	heldAbilitiesOf,
	withGainedSteps
} from '#lib/core/rules/gained-abilities.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

const data = committedGameData();
const characters = data.byId;
const cast = castWith({ characters });
const PLAYERS: CharacterId[] = ['amnesiac', 'chef', 'imp', 'empath', 'monk'];
// The Storyteller says the Amnesiac's ability works like `characterId`'s.
const worksLike =
	(characterId: CharacterId) =>
	(s: string[]): Command => ({
		type: 'SetHeldAbility',
		seatId: s[0],
		via: 'amnesiac',
		characterId
	});

describe('Amnesiac', () => {
	const character = committedCharacter('amnesiac');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Amnesiac');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['?', '?', '?']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('amnesiac')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// How to Run: the Storyteller decides the ability at setup and treats the player as having
	// it, waking them when it needs to.
	describe('its ability, as the Storyteller decides it', () => {
		it('is picked from its own seat only', () => {
			const { game, seats } = cast(PLAYERS);
			expect(abilityGivers(game, seats[0], characters)).toEqual(['amnesiac']);
			expect(abilityGivers(game, seats[1], characters)).toEqual([]);
		});

		it('holds nothing until the Storyteller picks', () => {
			const { game, seats } = cast(PLAYERS);
			expect(heldAbilitiesOf(game, seats[0], characters)).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Amnesiac#Examples)', () => {
		it.todo('Example 1: Ability: check two players for a Minion');
		// The Amnesiac learns a number each night about its living neighbours: the Storyteller
		// gives it a working ability like the Empath's, so it wakes at the Empath's time.
		it('Example 2: an ability like the Empath’s wakes the Amnesiac at the Empath’s time', () => {
			const { game, seats } = cast(
				['amnesiac', 'chef', 'imp', 'monk', 'poisoner'],
				worksLike('empath')
			);
			expect(heldAbilitiesOf(game, seats[0], characters)).toEqual([
				{ characterId: 'empath', via: 'amnesiac', works: true }
			]);
			const inPlay = game.seating.map((s) => characters.get(game.seats[s].characterId!)!);
			const steps = withGainedSteps(
				nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				game,
				characters,
				'other',
				data.nightSheet.otherNight
			);
			const empath = steps.filter((s) => s.gained?.characterId === 'empath');
			expect(empath).toHaveLength(1);
			expect(empath[0].gained?.seatId).toBe(seats[0]);
			expect(empath[0].reminder).toBe(characters.get('empath')?.otherNightReminder);
		});
	});
});
