/**
 * Sage: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sage
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sage.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { onDeathApplies, onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Sage', () => {
	const character = committedCharacter('sage');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Sage');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('sage')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sage#Examples)', () => {
		it('Example 1: Demon kills Sage early; two suspects shown', () => {
			// Wiki: "During the second night, the Demon kills the Sage. The Storyteller points at two players,
			// one of whom is the Demon."
			// The Demon kills the Sage: the Storyteller points to the Demon and one other player.
			const s = scenario(['sage', 'chef', 'imp', 'monk', 'poisoner']).dies('sage');
			const picker = infoPicker(s.game, s.seat('sage'), 'sage', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp'), s.seat('monk')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef'), s.seat('monk')] })).toBe(false);
		});

		it('Example 2: Drunk Sage gets misleading info', () => {
			// Wiki: "During the final night, the Demon kills the Sage, who is drunk because of the Sweetheart.
			// The Storyteller points at a dead player and one of the remaining three alive players. This
			// information is incorrect."
			// A Drunk who thinks they are the Sage may be shown any two players.
			const s = scenario(['sage', 'chef', 'imp', 'monk', 'poisoner']).drunk('sage').dies('sage');
			const picker = infoPicker(s.game, s.seat('sage'), 'sage', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('chef'), s.seat('monk')] })).toBe(true);
		});

		it("Example 3: Pit-Hag's arbitrary death leaves Sage uninformed", () => {
			// Wiki: "The Pit-Hag creates a Demon. Because the Pit-Hag ability says that "all deaths tonight
			// are arbitrary,” the Storyteller decides that the old Demon dies, and the Sage dies. Because the
			// Sage died due to the Pit-Hag, not the Demon, the Sage does not wake to learn anything tonight"
			const s = scenario(['sage', 'pithag', 'imp', 'chef', 'monk', 'empath'])
				.becomes('chef', 'nodashii', 'evil')
				.dies('imp', 'pithag')
				.dies('sage', 'pithag');
			const trigger = onDeathTrigger('sage', s.characters)!;
			expect(onDeathApplies(trigger, s.game.seats[s.seat('sage')].deathCause, s.characters)).toBe(
				false
			);
			// A kill by the new Demon would have woken the Sage.
			expect(onDeathApplies(trigger, 'nodashii', s.characters)).toBe(true);
		});
	});
});
