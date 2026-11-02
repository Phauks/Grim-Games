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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
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
import { characterNominationPrompts, nominationsPerDay } from '#lib/core/rules/nominations.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The Storyteller gives the Demon in `demon`'s seat a good ability through the Boffin. */
const boffinGives =
	(demon: string, characterId: string) =>
	(s: Scenario): Command => ({
		type: 'SetHeldAbility',
		seatId: s.seat(demon),
		via: 'boffin',
		characterId
	});
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
		it.fails("Example 1: Imp with Virgin ability executed by Alsaahir's nomination", () => {
			// Wiki: "The Imp has the Virgin ability. The Alsaahir nominates the Imp, and is immediately
			// executed."
			// Waits on the engine (M9): a nomination sets off only the nominee's own character's ability, not
			// one the Boffin gave them.
			const s = scenario(['boffin', 'imp', 'alsaahir', 'chef', 'empath'], { characters }).do(
				boffinGives('imp', 'virgin')
			);
			expect(heldAbilitiesOf(s.game, s.seat('imp'), s.characters)).toEqual([
				{ characterId: 'virgin', via: 'boffin', works: true }
			]);
			const nomination = { nominator: s.seat('alsaahir'), nominee: s.seat('imp') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toContainEqual({
				kind: 'execute-nominator',
				characterId: 'virgin',
				...nomination
			});
		});

		it('Example 2: Lord of Typhon with Chambermaid; Boffin drunk', () => {
			// Wiki: "The Lord of Typhon has the Chambermaid ability. Each night, the Lord of Typhon wakes,
			// chooses two players, and learns how many woke tonight. On the 4th night, the Boffin is drunk, so
			// the Demon has no Chambermaid ability, so does not wake."
			const s = scenario(['boffin', 'lordoftyphon', 'poisoner', 'chef', 'empath', 'sweetheart'], {
				characters
			}).do(boffinGives('lordoftyphon', 'chambermaid'));
			expect(gainedAbilities(s.game, s.characters)).toEqual([
				expect.objectContaining({ seatId: s.seat('lordoftyphon'), characterId: 'chambermaid' })
			]);
			const night4 = s.dies('sweetheart').reminder('boffin', 'sweetheart', 'Drunk');
			expect(gainedAbilities(night4.game, night4.characters)).toEqual([]);
			expect(heldAbilitiesOf(night4.game, night4.seat('lordoftyphon'), night4.characters)).toEqual([
				{ characterId: 'chambermaid', via: 'boffin', works: false }
			]);
		});

		it.fails('Example 3: Dead Kazali gets two nominations and votes a day', () => {
			// Wiki: "The Kazali has the Banshee ability. The Kazali dies at night, and the Scarlet Woman
			// becomes the Kazali. The dead Kazali may nominate and vote twice per day."
			// Waits on the engine (M9): a dead player's extra nominations come only from their own
			// character, not from an ability the Boffin gave them.
			const s = scenario(['boffin', 'kazali', 'scarletwoman', 'chef', 'empath', 'monk'], {
				characters
			})
				.do(boffinGives('kazali', 'banshee'))
				.dies('kazali', 'kazali')
				.reminder('scarletwoman', 'scarletwoman', 'Is The Demon')
				.becomes('scarletwoman', 'kazali')
				.newDay();
			expect(nominationsPerDay(s.game, s.seat('kazali'), s.characters)).toBe(2);
		});
	});
});
