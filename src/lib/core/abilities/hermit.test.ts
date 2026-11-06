/**
 * Hermit: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Hermit
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Hermit.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment, type CharacterId, type Script } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castWith } from '#lib/core/model/fixtures.test-support.ts';
import {
	gainedAbilities,
	heldAbilitiesOf,
	withGainedSteps
} from '#lib/core/rules/gained-abilities.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { borrowedCopyHolder, reminderHolders } from '#lib/core/rules/borrowed-abilities.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { reminderOffered, reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';

// A script whose Outsiders are the Hermit, Klutz, Butler and Recluse (the wiki's first example).
const IDS: CharacterId[] = [
	'hermit',
	'klutz',
	'butler',
	'recluse',
	'ravenkeeper',
	'washerwoman',
	'empath',
	'monk',
	'poisoner',
	'imp'
];
const script: Script = { entries: IDS.map((id) => ({ kind: 'official', id })) };
const data = committedGameData();
const characters = data.byId;
const cast = castWith({ script, characters });
const PLAYERS: CharacterId[] = ['hermit', 'ravenkeeper', 'imp', 'empath', 'monk'];
const kill =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });
const poison =
	(i: number) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId: 'poisoner', label: 'Poisoned' }
	});

describe('Hermit', () => {
	const character = committedCharacter('hermit');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Hermit');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['1', '2', '3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('hermit')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: the Hermit has every other Outsider ability on the script at once; after death it
	// keeps only one that goes on after death.
	// Wiki (How to Run): "Whenever appropriate, treat the Hermit as if they are the other
	// Outsiders, including waking them at night, and using other Outsiders’ reminder tokens."
	describe("the script's Outsider abilities", () => {
		it('holds every other Outsider on the script, with nothing to pick', () => {
			expect(rulesOf('hermit', characters)?.givesAbility).toEqual({
				to: 'self',
				types: ['outsider'],
				onScript: true,
				standIns: ['1', '2', '3']
			});
			const { game, seats } = cast(PLAYERS);
			expect(heldAbilitiesOf(game, seats[0], characters)).toEqual([
				{ characterId: 'klutz', via: 'hermit', works: true },
				{ characterId: 'butler', via: 'hermit', works: true },
				{ characterId: 'recluse', via: 'hermit', works: true }
			]);
			expect(heldAbilitiesOf(game, seats[1], characters)).toEqual([]);
		});

		it('has none while poisoned', () => {
			const { game, seats } = cast(
				['hermit', 'ravenkeeper', 'imp', 'empath', 'poisoner'],
				poison(0)
			);
			expect(heldAbilitiesOf(game, seats[0], characters).every((h) => !h.works)).toBe(true);
			expect(gainedAbilities(game, characters)).toEqual([]);
		});

		it('keeps only the abilities that work even if dead once it dies', () => {
			const { game, seats } = cast(PLAYERS, kill(0));
			expect(
				heldAbilitiesOf(game, seats[0], characters)
					.filter((h) => h.works)
					.map((h) => h.characterId)
			).toEqual(['recluse']);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Hermit#Examples)', () => {
		// The Hermit has the Klutz, Butler and Recluse abilities: it picks a master each night as
		// the Butler, though no Butler is in play.
		it('Example 1: the Hermit wakes each night to choose a master, as the Butler would', () => {
			// Wiki: "Marianna is the Hermit, and has the Klutz, Butler, and Recluse abilities. Each night,
			// she chooses a player as her master due to the Butler ability. The Ravenkeeper dies and
			// learns that she is the Lord of Typhon, due to the Recluse ability. Marianna is executed,
			// and chooses a player due to the Klutz ability. She chooses the Wizard. Good loses."
			const s = scenario(PLAYERS, { script, characters });
			const inPlay = s.game.seating.map((id) => characters.get(s.game.seats[id].characterId!)!);
			const order = data.nightSheet.otherNight;
			const steps = withGainedSteps(
				nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				s.game,
				s.characters,
				'other',
				order
			);
			const butler = steps.filter((step) => step.gained?.characterId === 'butler');
			expect(butler).toHaveLength(1);
			expect(butler[0].character?.id).toBe('hermit');
			expect(butler[0].gained?.seatId).toBe(s.seat('hermit'));
			expect(butler[0].reminder).toBe(characters.get('butler')?.otherNightReminder);
			// The Klutz and Recluse have no night text, so add no step.
			expect(steps.filter((step) => step.gained?.via === 'hermit')).toHaveLength(1);
		});
		it('Example 1 (rest): the Klutz choice after execution: good loses', () => {
			// Wiki: "Marianna is the Hermit, and has the Klutz, Butler, and Recluse abilities. Each night,
			// she chooses a player as her master due to the Butler ability. The Ravenkeeper dies and
			// learns that she is the Lord of Typhon, due to the Recluse ability. Marianna is executed,
			// and chooses a player due to the Klutz ability. She chooses the Wizard. Good loses."
			// The same script with the Lord of Typhon and the Wizard as its evil characters.
			const typhon: Script = {
				entries: [
					...IDS.filter((id) => id !== 'imp' && id !== 'poisoner'),
					'lordoftyphon',
					'wizard'
				].map((id) => ({ kind: 'official' as const, id }))
			};
			const s = scenario(['hermit', 'ravenkeeper', 'wizard', 'lordoftyphon', 'empath', 'monk'], {
				script: typhon,
				characters
			}).dies('ravenkeeper', 'lordoftyphon');
			const picker = infoPicker(s.game, s.seat('ravenkeeper'), 'ravenkeeper', s.characters)!;
			const asDemon = { seats: [s.seat('hermit')], characterId: 'lordoftyphon' };
			expect(isAllowed(picker, asDemon)).toBe(true);
			expect(isTruthful(picker, asDemon)).toBe(false);
			const executed = s.newDay().execute('hermit');
			expect(gameEnds(executed.game, executed.characters)).toEqual([]);
			const chose = executed.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('hermit'),
				characterId: 'klutz',
				on: at.seat('wizard')
			}));
			expect(gameEnds(chose.game, chose.characters)).toMatchObject([
				{ rule: 'used-on-loses', winner: 'evil', characterId: 'klutz' }
			]);
		});
		it('Example 2: Hermit as mistaken Exorcist executed; Alchemist drunk', () => {
			// Wiki: "Lewis is the Hermit and has the Drunk, Mutant, and Sweetheart abilities. Thinking
			// that he is the Exorcist, he chooses a player each night. Lewis says that he thinks he might
			// be the Drunk, so the Storyteller executes him due to the Mutant ability. Due to the
			// Sweetheart ability, the Alchemist is now drunk."
			// Waits on the engine (M15o): madnessOffer only treats a true Mutant as mad, not a Hermit holding the Mutant ability.
			const outsiders: Script = {
				entries: [
					'hermit',
					'drunk',
					'mutant',
					'sweetheart',
					'exorcist',
					'alchemist',
					'empath',
					'monk',
					'poisoner',
					'imp'
				].map((id) => ({ kind: 'official' as const, id }))
			};
			const s = scenario(['hermit', 'alchemist', 'empath', 'monk', 'imp'], {
				script: outsiders,
				characters
			});
			expect(
				heldAbilitiesOf(s.game, s.seat('hermit'), characters).map((h) => h.characterId)
			).toEqual(['drunk', 'mutant', 'sweetheart']);
			expect(madnessOffer(s.game, 'mutant', s.seat('hermit'), characters)).toMatchObject({
				breaking: 'execution'
			});
			const after = s.execute('hermit').reminder('alchemist', 'sweetheart', 'Drunk');
			expect(abilityState(after.game, after.seat('alchemist'), characters).works).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Hermit#How_to_Run)', () => {
		it('lets setup have one Outsider fewer and one Townsfolk more', () => {
			// Wiki: "During setup, you may remove an Outsider token and add a Townsfolk token."
			// Eight players usually have one Outsider.
			const inPlay = ['hermit', 'washerwoman', 'empath', 'monk', 'ravenkeeper', 'klutz', 'imp'];
			const result = analyseSetup({ players: 8, inPlay: inPlay.map((id) => characters.get(id)!) });
			expect(result.expected.outsider).toEqual([0, 1]);
			expect(result.expected.townsfolk).toEqual([5, 6]);
		});

		it("uses the Butler's own Master reminder for the Hermit's master", () => {
			// Wiki: "Whenever appropriate, treat the Hermit as if they are the other Outsiders,
			// including waking them at night, and using other Outsiders’ reminder tokens."
			const s = scenario(PLAYERS, { script, characters });
			const master = { characterId: 'butler', label: 'Master' };
			expect(reminderTargetMisses(s.game, master, s.seat('empath'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, master, s.seat('hermit'), s.characters)).toEqual([
				'self'
			]);
		});

		it('still has an Outsider ability that is in play, and has its own copy of its reminders', () => {
			// Wiki: "If the Hermit duplicates an in-play Outsider, use the Hermit’s 1, 2 and 3
			// reminders instead."
			const s = scenario(['hermit', 'butler', 'imp', 'empath', 'monk'], { script, characters });
			expect(
				heldAbilitiesOf(s.game, s.seat('hermit'), characters).map((h) => h.characterId)
			).toEqual(['klutz', 'butler', 'recluse']);
			// In place of the 1, 2 and 3, the Hermit has its own copy of the Butler's Master, with
			// its icon in the corner (M68, Trevor 2026-11-06), so the 1, 2 and 3 are never offered.
			for (const label of ['1', '2', '3'])
				expect(reminderOffered(s.game, { characterId: 'hermit', label }, s.characters)).toBe(false);
			expect(reminderHolders(s.game, s.characters).get('butler')).toEqual([
				s.seat('butler'),
				s.seat('hermit')
			]);
			const copy = (ownerSeatId: string) => ({ characterId: 'butler', ownerSeatId });
			expect(borrowedCopyHolder(s.game, copy(s.seat('hermit')), s.characters)).toBe('hermit');
			expect(borrowedCopyHolder(s.game, copy(s.seat('butler')), s.characters)).toBeUndefined();
		});
	});
});
