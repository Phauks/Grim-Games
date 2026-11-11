/**
 * Vigormortis: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vigormortis
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vigormortis.
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
import { abilityState } from '#lib/core/rules/ability.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { characterNominationPrompts } from '#lib/core/rules/nominations.ts';
import {
	neighbourSeats,
	reminderTargetMisses,
	reminderTargets
} from '#lib/core/rules/reminder-targets.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The players a character's day reminders name, such as the Witch's cursed player. */
const dayTargets = (s: Scenario, characterId: string) =>
	dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
		.groups.flatMap((g) => g.reminders)
		.filter((r) => r.characterId === characterId)
		.map((r) => r.target);

describe('Vigormortis', () => {
	const character = committedCharacter('vigormortis');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Vigormortis');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([
				'Dead',
				'Has Ability',
				'Has Ability',
				'Has Ability',
				'Poisoned',
				'Poisoned',
				'Poisoned'
			]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('vigormortis')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vigormortis#Examples)', () => {
		it("Example 1: Killed Witch's curse continues", () => {
			// Wiki: "The Vigormortis kills the Witch. The player that the Witch cursed tonight remains cursed.
			// The next day, when the cursed player nominates, they die."
			const s = scenario(['vigormortis', 'witch', 'chef', 'empath', 'monk', 'sage'])
				.reminder('chef', 'witch', 'Cursed')
				.dies('witch', 'vigormortis')
				.reminder('witch', 'vigormortis', 'Has Ability')
				.newDay();
			expect(abilityState(s.game, s.seat('witch'), s.characters).works).toBe(true);
			expect(dayTargets(s, 'witch')).toContain(s.seat('chef'));
			const nomination = { nominator: s.seat('chef'), nominee: s.seat('vigormortis') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toEqual([
				{ kind: 'kills-nominator', characterId: 'witch', ...nomination }
			]);
		});

		it('Example 2: Storyteller poisons Sage past the Klutz', () => {
			// Wiki: "The Vigormortis kills the Evil Twin. The Evil Twin neighbours a Klutz and a Flowergirl.
			// The Sage is the next neighbour to the Klutz. The Storyteller chooses that the Sage is poisoned."
			const s = scenario(['sage', 'klutz', 'eviltwin', 'flowergirl', 'vigormortis', 'mutant'])
				.dies('eviltwin', 'vigormortis')
				.reminder('eviltwin', 'vigormortis', 'Has Ability');
			const poison = { characterId: 'vigormortis', label: 'Poisoned' } as const;
			// The nearest Townsfolk each way round: the Flowergirl one way, the Sage past the Klutz.
			expect(neighbourSeats(s.game, poison, s.characters)?.sort()).toEqual(
				[s.seat('sage'), s.seat('flowergirl')].sort()
			);
			expect(reminderTargetMisses(s.game, poison, s.seat('sage'), s.characters)).toEqual([]);
			const after = s.reminder('sage', 'vigormortis', 'Poisoned');
			expect(
				abilityState(after.game, after.seat('sage'), after.characters).impairments
			).toMatchObject([{ reason: 'poisoned', source: { characterId: 'vigormortis' } }]);
			expect(abilityState(after.game, after.seat('eviltwin'), after.characters).works).toBe(true);
		});

		it("Example 3: Pit-Hag's chain of changes ends with Vortox", () => {
			// Wiki: "The Vigormortis kills the Pit-Hag. The Pit-Hag changes a Savant into a Witch. The
			// Vigormortis kills the Witch, who curses and kills a player. The Pit-Hag turns the dead Witch
			// into the Oracle, who now has no ability. The Pit-Hag turns the Vigormortis into a Vortox. The
			// Pit-Hag now has no ability."
			// A Has Ability token stops working once no Vigormortis is in play (M15g).
			const s = scenario([
				'vigormortis',
				'pithag',
				'savant',
				'chef',
				'empath',
				'monk',
				'sage',
				'mutant'
			])
				.dies('pithag', 'vigormortis')
				.reminder('pithag', 'vigormortis', 'Has Ability');
			expect(abilityState(s.game, s.seat('pithag'), s.characters).works).toBe(true);
			const witch = s
				.becomes('savant', 'witch')
				.dies('savant', 'vigormortis')
				.reminder('savant', 'vigormortis', 'Has Ability')
				.reminder('chef', 'witch', 'Cursed')
				.dies('chef', 'witch');
			expect(abilityState(witch.game, witch.seat('savant'), witch.characters).works).toBe(true);
			const oracle = witch.becomes('savant', 'oracle');
			expect(abilityState(oracle.game, oracle.seat('savant'), oracle.characters).works).toBe(false);
			const vortox = oracle.becomes('vigormortis', 'vortox');
			expect(abilityState(vortox.game, vortox.seat('pithag'), vortox.characters).works).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Vigormortis#How_to_Run)', () => {
		it('setup takes out one Outsider for a Townsfolk, and nothing without Outsiders', () => {
			// Wiki: "While setting up the game, before putting the character tokens in the bag, remove one
			// Outsider character token and add one Townsfolk character token. (If there are no Outsider
			// tokens to remove, do not add a Townsfolk token.)"
			expect(setupModifierFor(character)).toMatchObject({
				summary: '−1 Outsider',
				ops: [{ kind: 'delta', type: 'outsider', values: [-1] }],
				notes: ['With no Outsiders to remove, nothing changes.']
			});
		});

		it('kills one player each night after the first, marked Dead', () => {
			// Wiki: "Each night except the first, wake the Vigormortis. They point at any player. Put the
			// Vigormortis to sleep. If the chosen player isn’t a Minion, that player dies - mark them with
			// a DEAD reminder."
			expect(placeholdersFor(character, 'first')).toBeUndefined();
			const s = scenario(['vigormortis', 'witch', 'chef', 'empath', 'monk']).newDay();
			expect(nightKill(s.game, s.seat('vigormortis'), 'vigormortis', s.characters)?.max).toBe(1);
			const dead = { characterId: 'vigormortis', label: 'Dead' };
			expect(reminderTargets(s.game, dead, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});

		it('Has Ability goes only on a Minion it killed', () => {
			// Wiki: "If the chosen player is a Minion, that player dies - mark them with a DEAD reminder
			// and a HAS ABILITY reminder."
			const has = { characterId: 'vigormortis', label: 'Has Ability' };
			const s = scenario(['vigormortis', 'witch', 'chef', 'empath', 'monk']).newDay();
			expect(reminderTargetMisses(s.game, has, s.seat('witch'), s.characters)).toEqual([
				'with-label'
			]);
			const killed = s
				.dies('witch', 'vigormortis')
				.reminder('witch', 'vigormortis', 'Dead')
				.dies('chef', 'vigormortis')
				.reminder('chef', 'vigormortis', 'Dead');
			expect(
				reminderTargetMisses(killed.game, has, killed.seat('witch'), killed.characters)
			).toEqual([]);
			expect(
				reminderTargetMisses(killed.game, has, killed.seat('chef'), killed.characters)
			).toContain('type');
		});
	});
});
