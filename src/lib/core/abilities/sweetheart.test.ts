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
import { abilityState } from '#lib/core/rules/ability.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { reliability } from '#lib/core/rules/night-info.ts';
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
});
