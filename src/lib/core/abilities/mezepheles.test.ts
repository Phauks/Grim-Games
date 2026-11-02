/**
 * Mezepheles: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mezepheles
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mezepheles.
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
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { becomesOffer } from '#lib/core/rules/becomes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

const TURNS_EVIL = { characterId: 'mezepheles', label: 'Turns Evil' };

describe('Mezepheles', () => {
	const character = committedCharacter('mezepheles');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Mezepheles');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Turns Evil', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('mezepheles')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mezepheles#Examples)', () => {
		it('Example 1: Barber says the word, turns evil', () => {
			// Wiki: "The Mezepheles tells the Barber that the secret word is “Rumpelstiltskin”. The Barber
			// publicly says “This reminds me of the fairy tale where the Miller’s daughter has to guess
			// Rumpelstiltskin’s name”. The Barber turns evil that night."
			// Turns Evil goes on the Barber by day; taking it off that night turns them evil.
			const s = scenario(['barber', 'mezepheles', 'chef', 'empath', 'imp']).reminder(
				'barber',
				'mezepheles',
				'Turns Evil'
			);
			expect(becomesOffer(s.game, s.seat('barber'), TURNS_EVIL, s.characters, 'removed')).toEqual({
				into: 'evil',
				seatId: s.seat('barber'),
				characterId: 'barber'
			});
		});
		it('Example 2: Mayor exposes the Mezepheles to everyone', () => {
			// Wiki: "The Mezepheles tells the Mayor the secret word. The Mayor, wanting to stay good, tells
			// the group who the Mezepheles is."
			// The Mayor never says the word: no Turns Evil, so nobody turns evil and the ability is unused.
			const s = scenario(['mayor', 'mezepheles', 'chef', 'empath', 'imp']);
			expect(s.game.seats[s.seat('mayor')].reminders).toEqual([]);
			expect(alignmentOf(s.game, s.seat('mayor'))).toBe('good');
			expect(abilityState(s.game, s.seat('mezepheles'), s.characters).works).toBe(true);
		});
		// Waits on the engine: becomesOffer still offers Turns Evil's change while the Mezepheles is
		// drunk; it should offer none (or flag the impaired Mezepheles).
		it.fails('Example 3: Mezepheles drunk via Courtier; Noble stays good', () => {
			// Wiki: "The Mezepheles privately tells the Noble the secret word – “Constantinople”. The
			// Noble visits the Storyteller and says “Constantinople” in private. That night, the Courtier
			// makes the Mezepheles drunk. The Noble stays good."
			const s = scenario(['noble', 'mezepheles', 'courtier', 'empath', 'imp'])
				.reminder('noble', 'mezepheles', 'Turns Evil')
				.reminder('mezepheles', 'courtier', 'Drunk 3');
			expect(abilityState(s.game, s.seat('mezepheles'), s.characters).works).toBe(false);
			expect(
				becomesOffer(s.game, s.seat('noble'), TURNS_EVIL, s.characters, 'removed')
			).toBeUndefined();
		});
	});
});
