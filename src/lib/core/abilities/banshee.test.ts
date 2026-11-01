/**
 * Banshee: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Banshee
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Banshee.
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
import { afterDeath, nominationsPerDay } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Banshee', () => {
	const character = committedCharacter('banshee');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Banshee');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Has Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('banshee')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Banshee#Examples)', () => {
		it('Example 1: Demon kill grants extra nominations and votes', () => {
			// Wiki: "The Kazali kills the Banshee. All players learn that the Banshee has died. Tomorrow, the
			// Banshee nominates the Village Idiot and votes twice, then nominates the Fearmonger and votes
			// twice, then votes twice when the Shugenja is nominated. The next day, the Banshee doesn’t
			// nominate at all, but votes twice for the Kazali."
			const s = scenario(['banshee', 'villageidiot', 'fearmonger', 'shugenja', 'kazali', 'chef'])
				.dies('banshee', 'kazali')
				.newDay();
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toMatchObject({
				nominations: 2,
				votes: 2
			});
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(2);
			const next = s.nominate('banshee', 'villageidiot').nominate('banshee', 'fearmonger').newDay();
			expect(nominationsPerDay(next.game, next.seat('banshee'), next.characters)).toBe(2);
		});

		it.fails('Example 2: Poisoned Banshee killed; no power gained', () => {
			// Wiki: "The Banshee is poisoned. The Ojo kills the Banshee. Nobody learns that the Banshee has
			// died, and for the rest of the game, the Banshee may not nominate, and has just one vote."
			// Waits on the engine: a Banshee poisoned when the Demon killed them gains nothing, but
			// afterDeath reads only the cause of death.
			const s = scenario(['banshee', 'poisoner', 'ojo', 'chef', 'empath'])
				.poisoned('banshee')
				.dies('banshee', 'ojo')
				.newDay();
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toBeUndefined();
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(0);
		});

		it('Example 3: Lycanthrope kill grants no Banshee power', () => {
			// Wiki: "The Lycanthrope kills the Banshee. The Banshee does not gain their additional powers and
			// is not announced."
			const s = scenario(['banshee', 'lycanthrope', 'kazali', 'chef', 'empath']).dies(
				'banshee',
				'lycanthrope'
			);
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toBeUndefined();
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(0);
		});
	});
});
