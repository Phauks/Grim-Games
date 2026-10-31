/**
 * Big Wig: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Big_Wig
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Big Wig.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { characterNominationPrompts } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Big Wig', () => {
	const character = committedCharacter('bigwig');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Big Wig');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('bigwig')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Big_Wig#Examples)', () => {
		it('Example 1: Nominee defended as Sailor, survives', () => {
			// A nominated player picks a defender, who argues they are good. Whether the defender
			// broke madness is the Storyteller's call: the app offers it and does nothing itself.
			const s = scenario(['chef', 'sailor', 'monk', 'imp']).rule('bigwig');
			expect(
				characterNominationPrompts(
					s.game,
					{ nominator: s.seat('chef'), nominee: s.seat('sailor') },
					s.characters
				)
			).toEqual([
				{
					kind: 'nominee-chooses',
					characterId: 'bigwig',
					nominator: s.seat('chef'),
					nominee: s.seat('sailor')
				}
			]);
			const chose = s.nominate('chef', 'sailor').nomineeChose('monk');
			expect(
				madnessOffer(chose.game, 'bigwig', chose.seat('monk'), chose.characters)?.dies
			).toEqual([chose.seat('monk')]);
			expect(chose.game.seats[chose.seat('monk')].dead).toBe(false);
		});

		it('Example 2: Defender calls secret Hermit a Minion, dies', () => {
			// The defender argues the nominee is evil, so breaks madness: the Storyteller kills
			// them, with the Big Wig as the cause.
			const s = scenario(['chef', 'hermit', 'monk', 'imp'])
				.rule('bigwig')
				.nominate('monk', 'hermit')
				.nomineeChose('chef');
			const offer = madnessOffer(s.game, 'bigwig', s.seat('chef'), s.characters)!;
			expect(offer).toMatchObject({ breaking: 'death', dies: [s.seat('chef')] });
			const after = s.dies('chef', offer.characterId);
			expect(after.game.seats[after.seat('chef')]).toMatchObject({
				dead: true,
				deathCause: 'bigwig'
			});
		});
	});
});
