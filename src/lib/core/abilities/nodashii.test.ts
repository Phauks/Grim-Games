/**
 * No Dashii: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/No_Dashii
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes No Dashii.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { neighbourFollows } from '#lib/core/rules/reminder-movement.ts';
import { neighbourSeats, reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('No Dashii', () => {
	const character = committedCharacter('nodashii');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('No Dashii');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Poisoned', 'Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('nodashii')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/No_Dashii#Examples)', () => {
		const POISONED = { characterId: 'nodashii', label: 'Poisoned' };
		/** The seats the No Dashii's Poisoned reminder fits. */
		const fitting = (s: Scenario) =>
			reminderTargets(s.game, POISONED, s.characters).flatMap((fit) =>
				fit.misses.length === 0 ? [fit.seatId] : []
			);

		it('Example 1: Poisoned neighbours die; the next ones stay unpoisoned', () => {
			// Wiki: "At the start of the game, the No Dashii neighbors a Town Crier and a Snake Charmer.
			// They are both poisoned. A few days later, they are both dead, and the closest alive
			// neighbors to the No Dashii are an unpoisoned Clockmaker and an unpoisoned Barber."
			const s = scenario([
				'nodashii',
				'towncrier',
				'clockmaker',
				'chef',
				'witch',
				'barber',
				'snakecharmer'
			]);
			expect(new Set(neighbourSeats(s.game, POISONED, s.characters))).toEqual(
				new Set([s.seat('towncrier'), s.seat('snakecharmer')])
			);
			const later = s
				.reminder('towncrier', 'nodashii', 'Poisoned')
				.reminder('snakecharmer', 'nodashii', 'Poisoned')
				.newDay()
				.dies('towncrier', 'nodashii')
				.newDay()
				.dies('snakecharmer', 'nodashii')
				.newDay();
			// The dead Town Crier and Snake Charmer are still its nearest Townsfolk.
			expect(new Set(fitting(later))).toEqual(
				new Set([later.seat('towncrier'), later.seat('snakecharmer')])
			);
			expect(abilityState(later.game, later.seat('clockmaker'), later.characters).works).toBe(true);
			expect(abilityState(later.game, later.seat('barber'), later.characters).works).toBe(true);
		});

		it('Example 2: Poisons the closest Townsfolk on both sides', () => {
			// Wiki: "Clockwise from the No Dashii sits a Philosopher, a Mathematician, then a Sage.
			// Anticlockwise from the No Dashii sits a Witch, a Mutant, then a Seamstress. The
			// Philosopher and the Seamstress are poisoned"
			// Seating order runs clockwise.
			const s = scenario([
				'nodashii',
				'philosopher',
				'mathematician',
				'sage',
				'chef',
				'seamstress',
				'mutant',
				'witch'
			]);
			expect(new Set(neighbourSeats(s.game, POISONED, s.characters))).toEqual(
				new Set([s.seat('philosopher'), s.seat('seamstress')])
			);
			expect(new Set(fitting(s))).toEqual(new Set([s.seat('philosopher'), s.seat('seamstress')]));
			const poisoned = s
				.reminder('philosopher', 'nodashii', 'Poisoned')
				.reminder('seamstress', 'nodashii', 'Poisoned');
			for (const seat of ['philosopher', 'seamstress'] as const)
				expect(abilityState(poisoned.game, poisoned.seat(seat), poisoned.characters).works).toBe(
					false
				);
			expect(
				abilityState(poisoned.game, poisoned.seat('mathematician'), poisoned.characters).works
			).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/No_Dashii#How_to_Run)', () => {
		it('setup puts Poisoned on the nearest Townsfolk each way round', () => {
			// Wiki: "While preparing the first night, the two Townsfolk neighboring the No Dashii become
			// poisoned - mark them with POISONED reminders."
			expect(setupPrep('nodashii', 'No Dashii')).toMatchObject([
				{ tokens: ['Poisoned'], target: 'the nearest Townsfolk anticlockwise' },
				{ tokens: ['Poisoned'], target: 'the nearest Townsfolk clockwise' }
			]);
		});

		it('a poisoned neighbour who stops being a Townsfolk passes Poisoned to the next Townsfolk', () => {
			// Wiki: "If a Townsfolk poisoned by the No Dashii becomes a non-Townsfolk character, or the No
			// Dashii turns into a different character, or if a new player becomes the No Dashii, the new
			// neighbors of the No Dashii become poisoned, and the old neighbors become healthy - move the
			// No Dashii’s POISONED reminders immediately if needed."
			const s = scenario([
				'nodashii',
				'philosopher',
				'mathematician',
				'chef',
				'seamstress',
				'witch'
			])
				.reminder('philosopher', 'nodashii', 'Poisoned')
				.reminder('seamstress', 'nodashii', 'Poisoned');
			const after = s.becomes('philosopher', 'mutant');
			const moves = neighbourFollows(s.game, after.game, after.characters);
			expect(moves).toMatchObject([
				{ fromSeatId: s.seat('philosopher'), toSeatId: s.seat('mathematician') }
			]);
		});

		it('kills one player of its choice each night after the first, marked Dead', () => {
			// Wiki: "Each night except the first, wake the No Dashii. They point at any player. That player
			// dies - mark them with the DEAD reminder."
			expect(placeholdersFor(character, 'first')).toBeUndefined();
			expect(placeholdersFor(character, 'other')).toEqual([
				{ tokens: [{ label: 'Dead', action: 'place' }] }
			]);
			const s = scenario(['nodashii', 'philosopher', 'mathematician', 'chef', 'witch']).newDay();
			expect(nightKill(s.game, s.seat('nodashii'), 'nodashii', s.characters)?.max).toBe(1);
			const dead = { characterId: 'nodashii', label: 'Dead' };
			expect(reminderTargets(s.game, dead, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});
	});
});
