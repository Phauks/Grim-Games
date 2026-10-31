/**
 * Big Wig: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Big_Wig
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Big Wig.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { characterNominationPrompts } from '#lib/core/rules/nominations.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/**
 * A game with the Big Wig in play where the player in seat `nominee` is nominated by seat 0
 * and chooses the player in seat `chosen` to speak for them.
 */
function nominatedAndChose(cast: string[], nominee: number, chosen: number) {
	const nominate = (s: string[]): Command => ({
		type: 'Nominate',
		nominator: s[0],
		nominee: s[nominee]
	});
	const before = castGame(cast, { type: 'AddRuleCharacter', characterId: 'bigwig' }, nominate);
	const entryId = before.game.today.entries[0]!.entryId;
	return castGame(cast, { type: 'AddRuleCharacter', characterId: 'bigwig' }, nominate, (s) => ({
		type: 'ChooseForNomination',
		entryId,
		chosen: s[chosen]
	}));
}

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
			const { game, seats, ctx } = castGame(['chef', 'sailor', 'monk', 'imp'], {
				type: 'AddRuleCharacter',
				characterId: 'bigwig'
			});
			expect(
				characterNominationPrompts(game, { nominator: seats[0], nominee: seats[1] }, ctx.characters)
			).toEqual([
				{ kind: 'nominee-chooses', characterId: 'bigwig', nominator: seats[0], nominee: seats[1] }
			]);
			const chose = nominatedAndChose(['chef', 'sailor', 'monk', 'imp'], 1, 2);
			expect(madnessOffer(chose.game, 'bigwig', chose.seats[2], characters)?.dies).toEqual([
				chose.seats[2]
			]);
			expect(chose.game.seats[chose.seats[2]].dead).toBe(false);
		});

		it('Example 2: Defender calls secret Hermit a Minion, dies', () => {
			// The defender argues the nominee is evil, so breaks madness: the Storyteller kills
			// them, with the Big Wig as the cause.
			const chose = nominatedAndChose(['chef', 'hermit', 'monk', 'imp'], 1, 0);
			const offer = madnessOffer(chose.game, 'bigwig', chose.seats[0], characters)!;
			expect(offer).toMatchObject({ breaking: 'death', dies: [chose.seats[0]] });
			const after = castGame(
				['chef', 'hermit', 'monk', 'imp'],
				{ type: 'AddRuleCharacter', characterId: 'bigwig' },
				(s) => ({ type: 'SetDead', seatId: s[0], dead: true, cause: offer.characterId })
			);
			expect(after.game.seats[after.seats[0]]).toMatchObject({ dead: true, deathCause: 'bigwig' });
		});
	});
});
