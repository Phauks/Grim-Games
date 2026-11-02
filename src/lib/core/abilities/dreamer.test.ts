/**
 * Dreamer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Dreamer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Dreamer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { filledInfoToken, shownOrder, withChosen } from '#lib/core/rules/info-token-characters.ts';
import { infoPicker, isAllowed, reliability } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';

describe('Dreamer', () => {
	const character = committedCharacter('dreamer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Dreamer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('dreamer')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Dreamer#Examples)', () => {
		/** The Dreamer's "This player is" card once the Dreamer has chosen `chosen`. */
		const card = (s: Scenario, chosen: SeatRef) => {
			const filled = filledInfoToken(s.characters.get('dreamer')!, 'this-player-is', 2)!;
			const id = trueCharacter(s.game, s.seat(chosen), s.characters)!;
			// Under the Vortox the true character is not filled in (the Dreamer's info is false).
			const vortox = reliability(s.game, s.seat('dreamer'), 'dreamer', s.characters).mustBeFalse;
			return withChosen(filled, s.characters.get(id)!, vortox === true);
		};
		const typeOf = (s: Scenario) => (id: string) => s.characters.get(id)?.type;

		it('Example 1: Dreamer checks Mutant, sees Mutant or Cerenovus', () => {
			// Wiki: "The Dreamer chooses a player who is the Mutant. The Dreamer learns that this player
			// is either the Mutant or the Cerenovus."
			const s = scenario(['dreamer', 'mutant', 'cerenovus', 'chef', 'nodashii']);
			expect(card(s, 'mutant')).toMatchObject({
				characterIds: ['mutant'],
				othersAlignment: 'evil'
			});
			expect(s.characters.get('cerenovus')?.type).toBe('minion');
		});

		it('Example 2: Checked ex-Philosopher gets Philosopher or Vigormortis', () => {
			// Wiki: "The Dreamer chooses a player who was the Philosopher but gained the Flowergirl
			// ability earlier that night. The Dreamer learns that this player is either the
			// Philosopher or the Vigormortis."
			// The Philosopher's token is swapped for the Flowergirl, marked Is The Philosopher.
			const s = scenario(['dreamer', 'philosopher', 'chef', 'witch', 'vigormortis'])
				.becomes('philosopher', 'flowergirl')
				.reminder('philosopher', 'philosopher', 'Is The Philosopher');
			expect(card(s, 'philosopher')).toMatchObject({
				characterIds: ['philosopher'],
				othersAlignment: 'evil'
			});
		});

		it('Example 3: Storyteller shows Evil Twin paired with Artist', () => {
			// Wiki: "Today, both the Evil Twin and the Artist claimed to be the Artist. That night, the
			// Dreamer chooses the player who is the Evil Twin. If the Storyteller wanted to help the good
			// team, they could show the Evil Twin and the Sweetheart. But the Storyteller decides to help
			// evil, so they show the Evil Twin and the Artist to the Dreamer."
			const s = scenario(['dreamer', 'artist', 'eviltwin', 'sweetheart', 'nodashii']).reminder(
				'artist',
				'eviltwin',
				'Twin'
			);
			const shown = card(s, 'eviltwin');
			// Either good character may be the other one: the Storyteller picks.
			expect(shown).toMatchObject({ characterIds: ['eviltwin'], othersAlignment: 'good' });
			expect(shownOrder(shown, ['eviltwin', 'artist'], typeOf(s))).toEqual(['artist', 'eviltwin']);
		});

		it('Example 4: Vortox target misreads as Oracle or No Dashii', () => {
			// Wiki: "The Dreamer chooses a player who is the Vortox. The Dreamer's information must be
			// false because the Vortox is in play, so the Dreamer learns that this player is either the
			// Oracle or the No Dashii."
			const s = scenario(['dreamer', 'oracle', 'chef', 'witch', 'vortox']);
			expect(reliability(s.game, s.seat('dreamer'), 'dreamer', s.characters)).toMatchObject({
				mustBeFalse: true,
				falseBy: 'vortox'
			});
			expect(card(s, 'vortox').characterIds).not.toContain('vortox');
			// Neither character shown may be the Vortox: the Oracle and the No Dashii are both valid.
			const picker = infoPicker(s.game, s.seat('dreamer'), 'dreamer', s.characters)!;
			const vortox = [s.seat('vortox')];
			expect(isAllowed(picker, { seats: vortox, characterId: 'vortox' })).toBe(false);
			for (const characterId of ['oracle', 'nodashii']) {
				expect(isAllowed(picker, { seats: vortox, characterId })).toBe(true);
			}
		});
	});

	describe('the chosen player’s character (its `character-of` learns rule)', () => {
		it('offers every other player but Travellers, each with their true character', () => {
			const s = scenario(['dreamer', 'mutant', 'cerenovus', 'chef', 'nodashii', 'gunslinger']);
			const picker = infoPicker(s.game, s.seat('dreamer'), 'dreamer', s.characters)!;
			expect(picker.options.map((o) => [o.seats[0], o.characterId])).toEqual(
				(['mutant', 'cerenovus', 'chef', 'nodashii'] as const).map((id) => [s.seat(id), id])
			);
		});

		it('fills in the true character on the card when no Vortox is in play', () => {
			const s = scenario(['dreamer', 'mutant', 'cerenovus', 'chef', 'nodashii']);
			const filled = filledInfoToken(s.characters.get('dreamer')!, 'this-player-is', 2)!;
			expect(withChosen(filled, s.characters.get('mutant')!, false).characterIds).toEqual([
				'mutant'
			]);
			expect(withChosen(filled, s.characters.get('mutant')!, true)).toEqual({
				characterIds: [],
				upTo: 2,
				goodFirst: true
			});
		});
	});
});
