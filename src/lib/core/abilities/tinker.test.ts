/**
 * Tinker: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Tinker
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Tinker.
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
import { protection } from '#lib/core/rules/ability.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Tinker', () => {
	const character = committedCharacter('tinker');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Tinker');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('tinker')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Tinker#Examples)', () => {
		const tinkerCause = (s: Scenario, ref: string) =>
			validDeathCauses(s.game, s.seat(ref), s.characters).find((c) => c.cause === 'tinker');

		it('Example 1: Tinker dies overnight though Demon targeted another', () => {
			// Wiki: "During the night, the Tinker dies, even though the Demon attacked a different player."
			const s = scenario(['tinker', 'chef', 'imp', 'empath', 'poisoner'])
				.reminder('chef', 'imp', 'Dead')
				.dies('chef', 'imp');
			expect(tinkerCause(s, 'tinker')).toMatchObject({ kind: 'own-death', flags: [] });
			// The Tinker's ability kills only the Tinker.
			expect(tinkerCause(s, 'empath')).toBeUndefined();
		});

		it("Example 2: Tea Lady's protection keeps Tinker alive", () => {
			// Wiki: "The Tea Lady sits next to the Tinker and another good player, protecting the Tinker from
			// death. The Tinker cannot die from their ability."
			const s = scenario(['tinker', 'tealady', 'chef', 'imp', 'poisoner']).reminder(
				'tinker',
				'tealady',
				'Cannot Die'
			);
			expect(protection(s.game, s.seat('tinker'), s.characters, 'other')).toMatchObject({
				characterId: 'tealady'
			});
			// The Tinker's own death is offered with a caution: the Tea Lady protects them.
			expect(tinkerCause(s, 'tinker')?.flags).not.toEqual([]);
		});

		it("Example 3: Innkeeper's death later leads to Tinker's death", () => {
			// Wiki: "The Tinker is attacked by the Demon. The Tinker does not die because they are protected
			// by the Innkeeper. Later that night, the Innkeeper dies, so the Storyteller chooses to kill the
			// Tinker too."
			const s = scenario(['tinker', 'innkeeper', 'imp', 'chef', 'poisoner'])
				.reminder('tinker', 'innkeeper', 'Safe')
				.reminder('tinker', 'imp', 'Dead');
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					seatId: s.seat('tinker'),
					because: [{ kind: 'protected', source: { characterId: 'innkeeper' } }]
				}
			]);
			const after = s.dies('innkeeper');
			expect(
				protection(after.game, after.seat('tinker'), after.characters, 'other')
			).toBeUndefined();
			expect(tinkerCause(after, 'tinker')).toMatchObject({ flags: [] });
		});
	});
});
