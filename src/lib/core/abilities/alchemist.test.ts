/**
 * Alchemist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Alchemist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Alchemist.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

/** Seat 0 is the good Alchemist, its token swapped for the Minion whose ability it has. */
const alchemistAs = (minion: CharacterId, others: CharacterId[]) =>
	scenario([minion, ...others])
		.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'good' }))
		.reminder(0, 'alchemist', 'Is The Alchemist');

describe('Alchemist', () => {
	const character = committedCharacter('alchemist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Alchemist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Alchemist']);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('alchemist')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'reveal', name: 'replace-character' }]);
		});
	});

	// How to Run: its token is swapped for the Minion whose ability it has, marked "Is The
	// Alchemist"; the player is still the good Alchemist.
	describe('a swapped token marked "Is The Alchemist"', () => {
		it('offers only Minions to swap to, whatever its alignment', () => {
			expect(rulesOf('alchemist', characters)?.swapsForAbility).toEqual({
				token: 'Is The Alchemist',
				good: ['minion'],
				evil: ['minion']
			});
		});

		it('is really the good Alchemist, a Townsfolk', () => {
			// The swap keeps the Alchemist's good alignment (SeatCharacterFlow's gain).
			const { session, seats } = castGame(
				['poisoner', 'imp', 'chef'],
				(s) => ({ type: 'SetAlignment', seatId: s[0], alignment: 'good' }),
				(s) => ({
					type: 'AddReminder',
					seatId: s[0],
					reminder: { characterId: 'alchemist', label: 'Is The Alchemist' }
				})
			);
			const game = session.game;
			expect(game.seats[seats[0]].characterId).toBe('poisoner');
			expect(trueCharacter(game, seats[0], characters)).toBe('alchemist');
			expect(typeOf(game, seats[0], characters)).toBe('townsfolk');
			expect(alignmentOf(game, seats[0])).toBe('good');
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Alchemist#Examples)', () => {
		it.fails('Example 1: Alchemist with Baron ability: two extra Outsiders', () => {
			// Wiki: "The Alchemist has the Baron ability. There are 2 extra Outsiders in play."
			// Waits on the engine (M15o): the setup check counts the Alchemist only as a Townsfolk, not the
			// Minion ability it holds.
			const s = alchemistAs('baron', ['chef', 'empath', 'butler', 'saint', 'poisoner', 'imp']);
			expect(trueCharacter(s.game, s.seat(0), s.characters)).toBe('alchemist');
			const inPlay = s.game.seating.map((id) =>
				s.characters.get(trueCharacter(s.game, id, s.characters)!)!
			);
			const analysis = analyseSetup({ players: 7, inPlay });
			expect(analysis.expected.outsider).toEqual([2]);
		});

		it('Example 2: Alchemist-Poisoner switches poison target to King', () => {
			// Wiki: "The Alchemist has the Poisoner's ability. On the first night, they wake and poison the
			// Wizard. On the second night, they wake and poison the Alsaahir. On the third night, they wake
			// and try to poison the Lord of Typhon, but the Storyteller prompts them to choose differently.
			// They poison the King instead. The Lord of Typhon is not poisoned."
			// The third night's poison: the Storyteller's prompt itself is not modelled.
			const s = alchemistAs('poisoner', [
				'wizard',
				'lordoftyphon',
				'minstrel',
				'king',
				'alsaahir'
			]).poisoned('king');
			expect(abilityState(s.game, s.seat('king'), s.characters).impairments).toMatchObject([
				{ reason: 'poisoned', source: { characterId: 'poisoner' } }
			]);
			expect(abilityState(s.game, s.seat('lordoftyphon'), s.characters).works).toBe(true);
		});
	});
});
