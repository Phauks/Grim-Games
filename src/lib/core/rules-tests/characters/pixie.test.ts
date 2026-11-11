/**
 * Pixie: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pixie
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pixie.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night/info/picker.ts';
import { learnedRoles } from '#lib/core/rules/night/info/learned-roles.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence,
	committedCharacters
} from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/abilities/protection.ts';
import { gainedAbilities, withGainedSteps } from '#lib/core/rules/abilities/gained-abilities.ts';
import { madAsOf } from '#lib/core/rules/abilities/mad-as.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';
import { deathVerdict } from '#lib/core/rules/night/night-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Pixie', () => {
	const character = committedCharacter('pixie');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Pixie');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Mad', 'Has Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('pixie')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Pixie#How_to_Run)', () => {
		it('prepares Mad on an in-play Townsfolk other than the Pixie', () => {
			// Wiki: "During the first night, mark a Townsfolk character token with the Pixie’s MAD
			// reminder."
			expect(setupPrep('pixie', 'Pixie', committedCharacters()).map((step) => step.tokens)).toEqual(
				[['Mad']]
			);
			const s = scenario(['pixie', 'washerwoman', 'butler', 'imp', 'monk']);
			const mad = { characterId: 'pixie', label: 'Mad' };
			expect(reminderTargetMisses(s.game, mad, s.seat('washerwoman'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, mad, s.seat('butler'), s.characters)).not.toEqual([]);
			expect(reminderTargetMisses(s.game, mad, s.seat('imp'), s.characters)).not.toEqual([]);
			expect(reminderTargetMisses(s.game, mad, s.seat('pixie'), s.characters)).toContain('self');
		});

		it('is shown an in-play Townsfolk, the one marked Mad', () => {
			// Wiki: "Wake the Pixie. Show the Pixie this Townsfolk character token."
			const { game: g, seats } = castGame(
				['pixie', 'washerwoman', 'butler', 'imp', 'monk'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[1],
					reminder: { characterId: 'pixie', label: 'Mad' }
				})
			);
			const picker = infoPicker(g, seats[0], 'pixie', characters)!;
			expect(isTruthful(picker, { seats: [seats[1]], characterId: 'washerwoman' })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[2]], characterId: 'butler' })).toBe(false);
			expect(isAllowed(picker, { seats: [seats[3]], characterId: 'imp' })).toBe(false);
			expect(learnedRoles(g, picker, characters)!.rows[0]).toMatchObject({
				target: seats[1],
				marked: true
			});
		});
		it('is mad as the Townsfolk marked Mad, shown by the Pixie on the board', () => {
			// Wiki: "Wake the Pixie. Show the Pixie this Townsfolk character token."
			const s = scenario(['pixie', 'washerwoman', 'butler', 'imp', 'monk']);
			expect(madAsOf(s.game, s.seat('pixie'), s.characters)).toEqual([]);
			const marked = s.reminder('washerwoman', 'pixie', 'Mad');
			const reminderId = marked.game.seats[marked.seat('washerwoman')].reminders[0].reminderId;
			expect(madAsOf(marked.game, marked.seat('pixie'), marked.characters)).toEqual([
				{ characterId: 'washerwoman', by: 'pixie', reminderId }
			]);
			expect(madAsOf(marked.game, marked.seat('washerwoman'), marked.characters)).toEqual([]);
		});

		it('swaps Mad for Has Ability only once that Townsfolk is dead', () => {
			// Wiki: "If the Townsfolk marked MAD dies, and you feel that the Pixie player has been
			// sufficiently mad that they were this character, replace the MAD reminder with the HAS
			// ABILITY reminder."
			const s = scenario(['pixie', 'monk', 'chef', 'imp', 'poisoner']).reminder(
				'monk',
				'pixie',
				'Mad'
			);
			const has = { characterId: 'pixie', label: 'Has Ability' };
			expect(reminderTargetMisses(s.game, has, s.seat('monk'), s.characters)).not.toEqual([]);
			const dead = s.dies('monk', 'execution');
			expect(reminderTargetMisses(dead.game, has, dead.seat('monk'), dead.characters)).toEqual([]);
		});

		it("wakes the Pixie right after that Townsfolk's own step once it has the ability", () => {
			// Wiki: "The Pixie now has this Townsfolk’s ability, and will wake at night when this
			// Townsfolk would normally wake."
			const s = scenario(['pixie', 'monk', 'chef', 'imp', 'poisoner'])
				.reminder('monk', 'pixie', 'Mad')
				.dies('monk', 'execution')
				.reminder('monk', 'pixie', 'Has Ability');
			const data = committedGameData();
			const inPlay = ['pixie', 'monk', 'chef', 'imp', 'poisoner'].map((id) => data.byId.get(id)!);
			const steps = withGainedSteps(
				nightOrder({
					night: 'other',
					sheet: data.nightSheet,
					inPlay,
					players: 5,
					official: data.byId
				}).steps,
				s.game,
				s.characters,
				'other'
			);
			const at = steps.findIndex((step) => step.id === 'monk');
			expect(steps[at + 1]).toMatchObject({
				character: { id: 'pixie' },
				gained: { characterId: 'monk', status: 'has-ability' }
			});
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pixie#Examples)', () => {
		it('Example 1: Pixie gains Washerwoman power after mad claim', () => {
			// Wiki: "Amy is the Pixie, and knows that the Washerwoman is in play. For three days, Amy claims
			// that the Washerwoman player is lying, because she is the Washerwoman. The Washerwoman is
			// executed. That night, Amy gains the Washerwoman ability, and learns that one of two people
			// is the Monk."
			const s = scenario(['pixie', 'washerwoman', 'monk', 'chef', 'poisoner', 'imp'])
				.reminder('washerwoman', 'pixie', 'Mad')
				.newDay()
				.execute('washerwoman')
				.reminder('washerwoman', 'pixie', 'Has Ability');
			expect(gainedAbilities(s.game, s.characters)).toContainEqual(
				expect.objectContaining({
					seatId: s.seat('pixie'),
					characterId: 'washerwoman',
					via: 'pixie',
					status: 'has-ability'
				})
			);
			const picker = infoPicker(s.game, s.seat('pixie'), 'washerwoman', s.characters)!;
			const pair = { seats: [s.seat('monk'), s.seat('chef')], characterId: 'monk' };
			expect(isTruthful(picker, pair)).toBe(true);
		});
		it("Example 2: Drunk Pixie's fake Lycanthrope attacks never work", () => {
			// Wiki: "Doug is the Drunk Pixie. He learns that the Lycanthrope is in play. There is no
			// Lycanthrope in play, but a Minion bluffs as the Lycanthrope. The Minion dies. The
			// Storyteller wakes Doug and Doug chooses a player to “attack” each night, but they do not die
			// because Doug does not have the Lycanthrope ability."
			const s = scenario(['pixie', 'chef', 'empath', 'monk', 'poisoner', 'imp'])
				.drunk('pixie')
				.dies('poisoner', 'execution');
			const attack = deathVerdict(
				s.game,
				s.seat('pixie'),
				'lycanthrope',
				{ seatId: s.seat('chef') },
				s.characters
			);
			expect(attack).toMatchObject({ kind: 'no-death', because: 'impaired' });
		});
		it('Example 3: Shared Soldier claim denies Pixie the ability', () => {
			// Wiki: "On the first day, the Pixie player claims to be the Soldier. The real Soldier also
			// claims to be the Soldier. The Pixie player doesn’t dispute this. When the Soldier dies, the
			// Pixie player does not gain the Soldier ability, as the Storyteller feels that the Pixie did
			// not really pretend to be the Soldier."
			// The Storyteller never places Has Ability: the gain stays their call (if mad).
			const s = scenario(['pixie', 'soldier', 'chef', 'empath', 'poisoner', 'imp'])
				.reminder('soldier', 'pixie', 'Mad')
				.dies('soldier', 'execution');
			expect(gainedAbilities(s.game, s.characters)).toContainEqual(
				expect.objectContaining({
					seatId: s.seat('pixie'),
					characterId: 'soldier',
					status: 'if-mad'
				})
			);
			expect(protection(s.game, s.seat('pixie'), s.characters, 'demon')).toBeUndefined();
		});
	});
});
