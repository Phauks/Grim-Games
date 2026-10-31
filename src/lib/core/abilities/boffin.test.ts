/**
 * Boffin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Boffin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Boffin.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import {
	abilityGivers,
	gainedAbilities,
	heldAbilitiesOf,
	withGainedSteps
} from '#lib/core/rules/gained-abilities.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

// The Storyteller gives the Demon (seat 1) the Chef's ability, from its seat's menu.
const giveChef = (s: string[]): Command => ({
	type: 'SetHeldAbility',
	seatId: s[1],
	via: 'boffin',
	characterId: 'chef'
});

describe('Boffin', () => {
	const character = committedCharacter('boffin');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Boffin');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('boffin')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: the Demon has one not-in-play Townsfolk or Outsider ability, even if the Demon is
	// drunk or poisoned, but not while the Boffin is. How to Run: the good token sits by the
	// Demon's, and the Demon wakes when that good character would.
	describe("the Demon's good ability", () => {
		it('offers a not-in-play Townsfolk or Outsider, held by the Demon while the Boffin works', () => {
			expect(rulesOf('boffin', characters)?.givesAbility).toEqual({
				to: 'demon',
				types: ['townsfolk', 'outsider'],
				notInPlay: true,
				whileWorks: true
			});
		});

		it("is picked from the Demon's seat only", () => {
			const { game, seats } = castGame(['boffin', 'imp', 'monk', 'empath', 'saint']);
			expect(abilityGivers(game, seats[1], characters)).toEqual(['boffin']);
			expect(abilityGivers(game, seats[2], characters)).toEqual([]);
		});

		it('is held by the Demon', () => {
			const { game, seats } = castGame(['boffin', 'imp', 'monk', 'empath', 'saint'], giveChef);
			expect(heldAbilitiesOf(game, seats[1], characters)).toEqual([
				{ characterId: 'chef', via: 'boffin', works: true }
			]);
			expect(game.seats[seats[1]].abilities).toEqual([{ characterId: 'chef', via: 'boffin' }]);
			expect(gainedAbilities(game, characters)).toEqual([
				{ seatId: seats[1], via: 'boffin', characterId: 'chef', status: 'has-ability' }
			]);
		});

		it('is lost while the Boffin is poisoned or dead, and kept while the Demon is poisoned', () => {
			const poison =
				(i: number) =>
				(s: string[]): Command => ({
					type: 'AddReminder',
					seatId: s[i],
					reminder: { characterId: 'poisoner', label: 'Poisoned' }
				});
			const boffinPoisoned = castGame(
				['boffin', 'imp', 'poisoner', 'empath', 'saint'],
				giveChef,
				poison(0)
			);
			expect(gainedAbilities(boffinPoisoned.game, characters)).toEqual([]);
			const demonPoisoned = castGame(
				['boffin', 'imp', 'poisoner', 'empath', 'saint'],
				giveChef,
				poison(1)
			);
			expect(gainedAbilities(demonPoisoned.game, characters)).toHaveLength(1);
			const boffinDead = castGame(['boffin', 'imp', 'monk', 'empath', 'saint'], giveChef, (s) => ({
				type: 'SetDead',
				seatId: s[0],
				dead: true,
				cause: 'execution'
			}));
			expect(gainedAbilities(boffinDead.game, characters)).toEqual([]);
		});

		it('is not held by a player who is no longer the Demon', () => {
			const { game } = castGame(['boffin', 'imp', 'monk', 'empath', 'saint'], giveChef, (s) => ({
				type: 'AssignCharacter',
				seatId: s[1],
				characterId: 'soldier',
				alignment: 'good'
			}));
			expect(gainedAbilities(game, characters)).toEqual([]);
		});

		it("wakes the Demon where the Chef would on the first night, though the Chef isn't in play", () => {
			const { game, seats } = castGame(['boffin', 'imp', 'monk', 'empath', 'saint'], giveChef);
			const data = committedGameData();
			const inPlay = game.seating.map((s) => data.byId.get(game.seats[s].characterId!)!);
			const order = data.nightSheet.firstNight;
			const steps = withGainedSteps(
				nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				game,
				characters,
				'first',
				order
			);
			const at = steps.findIndex((s) => s.gained?.characterId === 'chef');
			const step = steps[at];
			expect(step.character?.id).toBe('imp');
			expect(step.gained?.seatId).toBe(seats[1]);
			expect(step.reminder).toBe(characters.get('chef')?.firstNightReminder);
			// Between the steps the sheet puts either side of the Chef.
			const chef = order.indexOf('chef');
			expect(order.indexOf(steps[at - 1].id)).toBeLessThan(chef);
			expect(order.indexOf(steps[at + 1].id)).toBeGreaterThan(chef);
		});

		it('can be taken away', () => {
			const { game, seats } = castGame(
				['boffin', 'imp', 'monk', 'empath', 'saint'],
				giveChef,
				(s) => ({ type: 'SetHeldAbility', seatId: s[1], via: 'boffin' })
			);
			expect(game.seats[seats[1]].abilities).toBeUndefined();
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Boffin#Examples)', () => {
		it.todo("Example 1: Imp with Virgin ability executed by Alsaahir's nomination");
		it.todo('Example 2: Lord of Typhon with Chambermaid; Boffin drunk');
		it.todo('Example 3: Dead Kazali gets two nominations and votes a day');
	});
});
