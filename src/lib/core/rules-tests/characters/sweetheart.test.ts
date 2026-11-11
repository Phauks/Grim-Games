/**
 * Sweetheart: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sweetheart
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sweetheart.
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
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { deathReminder } from '#lib/core/rules/abilities/first-death.ts';
import { madnessOffer } from '#lib/core/rules/day/madness.ts';
import {
	nightStepAlerts,
	onDeathApplies,
	onDeathTrigger
} from '#lib/core/rules/night/night-alerts.ts';
import { placeholdersFor } from '#lib/core/rules/night/night-text.ts';
import { reminderTargets } from '#lib/core/rules/reminders/reminder-targets.ts';
import { reliability } from '#lib/core/rules/night/info/reliability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Sweetheart', () => {
	const character = committedCharacter('sweetheart');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition snv', () => {
			expect(character.name).toBe('Sweetheart');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('sweetheart')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sweetheart#Examples)', () => {
		it('Example 1: Mathematician is drunk, so night info misleads', () => {
			// Wiki: "The Sweetheart dies. The Mathematician is now drunk, and may get false information at
			// night."
			const s = scenario(['sweetheart', 'mathematician', 'chef', 'vortox', 'witch'])
				.dies('sweetheart')
				.reminder('mathematician', 'sweetheart', 'Drunk');
			const r = reliability(s.game, s.seat('mathematician'), 'mathematician', s.characters);
			expect(r.unreliable).toBe('drunk');
		});

		it('Example 2: Drunk Mutant may break madness without risk', () => {
			// Wiki: "The Sweetheart dies. The Mutant is now drunk. The Mutant may safely come out as the
			// Mutant, but they do not know this."
			const s = scenario(['sweetheart', 'mutant', 'chef', 'vortox', 'witch']);
			expect(madnessOffer(s.game, 'mutant', s.seat('mutant'), s.characters)).toBeDefined();
			const drunk = s.dies('sweetheart').reminder('mutant', 'sweetheart', 'Drunk');
			expect(
				madnessOffer(drunk.game, 'mutant', drunk.seat('mutant'), drunk.characters)
			).toBeUndefined();
		});

		it("Example 3: Drunk Demon's nightly kill fails", () => {
			// Wiki: "The Sweetheart dies. The Demon is now drunk, so their attack at night won’t kill anyone."
			const s = scenario(['sweetheart', 'chef', 'empath', 'vortox', 'witch'])
				.dies('sweetheart')
				.reminder('vortox', 'sweetheart', 'Drunk');
			expect(abilityState(s.game, s.seat('vortox'), s.characters).works).toBe(false);
			expect(nightStepAlerts(s.game, 'vortox', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'impaired',
					seatId: s.seat('vortox'),
					works: false,
					impairments: [expect.objectContaining({ reason: 'drunk' })]
				})
			);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Sweetheart#How_to_Run)', () => {
		it('any death of the Sweetheart, an execution too, makes a player drunk', () => {
			// Wiki: "If the Sweetheart dies, you choose any one player to become drunk - mark this player
			// with the DRUNK reminder."
			const s = scenario(['sweetheart', 'mathematician', 'chef', 'vortox', 'witch']).execute(
				'sweetheart'
			);
			const trigger = onDeathTrigger('sweetheart', s.characters)!;
			expect(
				onDeathApplies(trigger, s.game.seats[s.seat('sweetheart')].deathCause, s.characters)
			).toBe(true);
			expect(onDeathApplies(trigger, 'vortox', s.characters)).toBe(true);
		});

		it('Drunk may go on any one player', () => {
			// Wiki: "If the Sweetheart dies, you choose any one player to become drunk - mark this player
			// with the DRUNK reminder."
			expect(placeholdersFor(character, 'other')).toEqual([
				{ tokens: [{ label: 'Drunk', action: 'place' }] }
			]);
			const s = scenario(['sweetheart', 'mathematician', 'chef', 'vortox', 'witch']).dies(
				'sweetheart'
			);
			const drunk = { characterId: 'sweetheart', label: 'Drunk' };
			expect(reminderTargets(s.game, drunk, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});

		it('the player stays drunk on later days, though the Sweetheart is dead', () => {
			// Wiki: "The Sweetheart does not lose this ability when dead."
			const s = scenario(['sweetheart', 'mathematician', 'chef', 'vortox', 'witch'])
				.dies('sweetheart')
				.reminder('chef', 'sweetheart', 'Drunk')
				.newDay()
				.dusk()
				.newDay();
			expect(abilityState(s.game, s.seat('chef'), s.characters)).toMatchObject({
				works: false,
				impairments: [{ reason: 'drunk', source: { characterId: 'sweetheart' } }]
			});
		});
	});

	describe('the death asks whom to make drunk (https://wiki.bloodontheclocktower.com/Sweetheart#How_to_Run)', () => {
		const cast = ['sweetheart', 'mathematician', 'chef', 'vortox', 'witch'];

		it('offers its Drunk for a player the Storyteller picks, once', () => {
			// Wiki: "If the Sweetheart dies, you choose any one player to become drunk - mark this
			// player with the DRUNK reminder."
			const s = scenario(cast).execute('sweetheart');
			const at = s.seat('sweetheart');
			expect(deathReminder(s.game, at, 'execution', s.characters)).toEqual({
				characterId: 'sweetheart',
				label: 'Drunk',
				chosen: true
			});
			// Already on someone: not offered again.
			const marked = s.reminder('chef', 'sweetheart', 'Drunk');
			expect(deathReminder(marked.game, at, 'execution', marked.characters)).toBeUndefined();
		});

		it('offers nothing while the Sweetheart is drunk or poisoned', () => {
			// Wiki: "If the Sweetheart dies, you choose any one player to become drunk - mark this
			// player with the DRUNK reminder."
			const s = scenario(['sweetheart', 'mathematician', 'chef', 'vortox', 'poisoner'])
				.poisoned('sweetheart')
				.execute('sweetheart');
			expect(
				deathReminder(s.game, s.seat('sweetheart'), 'execution', s.characters)
			).toBeUndefined();
		});
	});
});
