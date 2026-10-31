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
import { castWith, run } from '#lib/core/model/fixtures.test-support.ts';
import { dayClaim } from '#lib/core/rules/day-claims.ts';
import type { DayEntry, Game } from '#lib/core/model/types.ts';
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

	// Summary: each day the Amnesiac guesses its ability in private, and the Storyteller
	// answers Cold (very wrong), Warm (on the right track), Hot (very close) or Bingo.
	describe('the daily guess', () => {
		const guess = (s: string[]): Command => ({
			type: 'DayNote',
			characterId: 'amnesiac',
			seatId: s[0],
			text: 'Is it about Minions?',
			answer: 'hot'
		});
		const notes = (game: Game) =>
			game.today.entries.filter((e): e is Extract<DayEntry, { kind: 'note' }> => e.kind === 'note');

		it('is a claim the day log keeps', () => {
			expect(dayClaim('amnesiac', characters)).toBe('ability-guess');
		});

		it('keeps the Storyteller’s answer, and a later edit changes it', () => {
			const { session, ctx, game, seats } = cast(PLAYERS, guess);
			expect(notes(game)).toEqual([expect.objectContaining({ answer: 'hot' })]);
			const [entry] = notes(game);
			const edited = run(session, ctx, {
				type: 'EditDayNote',
				entryId: entry.entryId,
				text: 'Do I detect Minions among two players?',
				answer: 'bingo'
			});
			expect(notes(edited.game)).toEqual([
				expect.objectContaining({ seatId: seats[0], answer: 'bingo' })
			]);
		});

		it('leaves out an answer that is not one of the four', () => {
			const { game } = cast(PLAYERS, (s) => ({
				...guess(s),
				answer: 'lukewarm' as never
			}));
			expect(notes(game)[0]).not.toHaveProperty('answer');
		});

		// The answers are a range (Trevor, 2026-10-31), so one in the Storyteller's own words is
		// kept as typed when none of the four fits.
		it('keeps an answer in the Storyteller’s own words, and a standard one replaces it', () => {
			const { session, ctx, game } = cast(PLAYERS, (s) => ({
				...guess(s),
				answer: undefined,
				customAnswer: '  Lukewarm '
			}));
			expect(notes(game)).toEqual([expect.objectContaining({ customAnswer: 'Lukewarm' })]);
			expect(notes(game)[0]).not.toHaveProperty('answer');
			const [entry] = notes(game);
			const edited = run(session, ctx, {
				type: 'EditDayNote',
				entryId: entry.entryId,
				text: entry.text,
				answer: 'warm',
				customAnswer: 'Lukewarm'
			});
			expect(notes(edited.game)[0]).toMatchObject({ answer: 'warm' });
			expect(notes(edited.game)[0]).not.toHaveProperty('customAnswer');
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
