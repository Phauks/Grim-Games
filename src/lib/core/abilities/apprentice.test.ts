/**
 * Apprentice: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Apprentice
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Apprentice.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
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
import { abilityState } from '#lib/core/rules/ability.ts';
import { survivesFirstDeath } from '#lib/core/rules/first-death.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { deathVerdict } from '#lib/core/rules/night-deaths.ts';
import { infoPicker } from '#lib/core/rules/night-info/picker.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
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
		it('Example 1: Evil Apprentice gets Assassin, kills Fool', () => {
			// Wiki: "The evil Apprentice gains the Assassin ability. That night, they kill the Fool."
			// The Apprentice's token is swapped for the Assassin, marked Is The Apprentice.
			const s = scenario(['apprentice', 'fool', 'chef', 'empath', 'imp'])
				.becomes('apprentice', 'assassin', 'evil')
				.reminder('apprentice', 'apprentice', 'Is The Apprentice')
				.reminder('fool', 'assassin', 'Dead');
			expect(trueCharacter(s.game, s.seat('apprentice'), s.characters)).toBe('apprentice');
			expect(abilityState(s.game, s.seat('apprentice'), s.characters).works).toBe(true);
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'assassin', s.characters)).toBeUndefined();
			const fool = nightStepAlerts(s.game, 'assassin', s.characters).filter(
				(a) => a.seatId === s.seat('fool')
			);
			expect(fool.map((a) => a.kind)).not.toContain('survives-first-death');
		});
		it('Example 2: Wrong Tea Lady guess kills the Gambler', () => {
			// Wiki: "The good Apprentice gains the Chambermaid ability. From now on, they learn who
			// wakes at night. Later, the Gambler guesses that the Apprentice is the Tea Lady. The
			// Gambler dies, because the Apprentice is not the Tea Lady, but the Apprentice."
			const s = scenario(['apprentice', 'gambler', 'chef', 'empath', 'imp'])
				.becomes('apprentice', 'chambermaid', 'good')
				.reminder('apprentice', 'apprentice', 'Is The Apprentice');
			expect(
				infoPicker(s.game, s.seat('apprentice'), 'chambermaid', s.characters, 'other')
			).toBeDefined();
			const guess = (characterId: string) =>
				deathVerdict(
					s.game,
					s.seat('gambler'),
					'gambler',
					{ seatId: s.seat('apprentice'), characterId },
					s.characters
				);
			expect(guess('tealady')).toMatchObject({ kind: 'dies', seatIds: [s.seat('gambler')] });
			// Not the Chambermaid either: the player is the Apprentice.
			expect(guess('chambermaid')).toMatchObject({ kind: 'dies', seatIds: [s.seat('gambler')] });
			expect(guess('apprentice')).toMatchObject({ kind: 'no-death', because: 'right-guess' });
		});
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
