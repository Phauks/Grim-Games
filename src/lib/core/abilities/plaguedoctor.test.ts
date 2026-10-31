/**
 * Plague Doctor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Plague_Doctor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Plague Doctor.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	testCharacters as characters,
	type CastGame
} from '#lib/core/model/fixtures.test-support.ts';
import { withNightInfo } from '#lib/core/rules/night-info.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

function otherNight(game: CastGame['game']) {
	const data = committedGameData();
	const inPlay = game.seating.map((s) => data.byId.get(game.seats[s].characterId!)!);
	return withNightInfo(
		nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps,
		game,
		characters,
		'other',
		{ died: [] },
		data.nightSheet.otherNight
	);
}

describe('Plague Doctor', () => {
	const character = committedCharacter('plaguedoctor');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Plague Doctor');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Storyteller Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('plaguedoctor')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: when it dies, the Storyteller gains a Minion ability of their choice for the rest
	// of the game. How to Run: a Minion token marked Storyteller Ability, with a night step
	// where the Storyteller makes that Minion's choices.
	it('gives the Storyteller a Minion ability', () => {
		expect(rulesOf('plaguedoctor', characters)?.givesAbility).toEqual({
			to: 'storyteller',
			types: ['minion'],
			token: 'Storyteller Ability'
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Plague_Doctor#Examples)', () => {
		// Once the Plague Doctor has died, the Storyteller picks the Minion ability they gain.
		const gains = (cast: string[], characterId: string) =>
			scenario(cast)
				.dies('plaguedoctor', 'execution')
				.do({ type: 'SetStorytellerAbility', via: 'plaguedoctor', characterId });

		it('Example 1: Storyteller gains Poisoner, poisoning nightly', () => {
			// The Plague Doctor dies and the Storyteller takes the Poisoner's ability: each night
			// there is a Poisoner step for the Storyteller, though no Poisoner is in play.
			const s = gains(['plaguedoctor', 'imp', 'monk', 'empath', 'chef'], 'poisoner');
			expect(s.game.storytellerAbilities).toEqual([
				{ characterId: 'poisoner', via: 'plaguedoctor' }
			]);
			const step = otherNight(s.game).find((step) => step.storytellerAbility);
			expect(step?.character?.id).toBe('poisoner');
			expect(step?.reminder).toBe(s.characters.get('poisoner')?.otherNightReminder);
			expect(step?.info).toBeUndefined();
		});

		it('Example 2: Storyteller as Pit-Hag makes a second Cerenovus', () => {
			// The Storyteller holds the Cerenovus ability and a player becomes the Cerenovus too:
			// two Cerenovus steps, the Storyteller's right after the player's.
			const s = gains(['plaguedoctor', 'imp', 'cerenovus', 'empath', 'chef'], 'cerenovus');
			const ids = otherNight(s.game).map((step) => step.id);
			const own = ids.indexOf('cerenovus');
			expect(own).toBeGreaterThanOrEqual(0);
			expect(ids[own + 1]).toBe('storyteller:plaguedoctor:cerenovus');
		});

		it("Example 3: Later drunkenness doesn't remove the gained ability", () => {
			// The Storyteller has had the Organ Grinder's ability for days when a Minstrel makes the
			// Plague Doctor drunk: it was gained at the death, so it stays.
			const s = gains(
				['plaguedoctor', 'imp', 'minstrel', 'empath', 'chef'],
				'organgrinder'
			).reminder('plaguedoctor', 'minstrel', 'Drunk');
			expect(s.game.storytellerAbilities).toEqual([
				{ characterId: 'organgrinder', via: 'plaguedoctor' }
			]);
		});
	});
});
