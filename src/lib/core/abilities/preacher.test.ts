/**
 * Preacher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Preacher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Preacher.
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
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Preacher', () => {
	const character = committedCharacter('preacher');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Preacher');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability', 'No Ability', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('preacher')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Preacher#Examples)', () => {
		it("Example 1: Non-Minion chosen; Preacher's power does nothing", () => {
			// Wiki: "The Preacher points to Alex, who is the Engineer. Nothing happens."
			// No No Ability token goes on a Townsfolk; even if one did, it would take nothing away.
			const s = scenario(['preacher', 'engineer', 'chef', 'cerenovus', 'imp']).reminder(
				'engineer',
				'preacher',
				'No Ability'
			);
			expect(abilityState(s.game, s.seat('engineer'), s.characters).works).toBe(true);
		});
		it('Example 2: Minion learns of preaching, loses ability', () => {
			// Wiki: "The Preacher points to Lachlan, who is the Cerenovus. Lachlan wakes to learn that
			// he has been preached, and is not woken to use his ability."
			const s = scenario(['preacher', 'chef', 'cerenovus', 'empath', 'imp']).reminder(
				'cerenovus',
				'preacher',
				'No Ability'
			);
			const state = abilityState(s.game, s.seat('cerenovus'), s.characters);
			expect(state.works).toBe(false);
			expect(state.impairments).toMatchObject([
				{ reason: 'no-ability', source: { characterId: 'preacher', seatId: s.seat('preacher') } }
			]);
		});
		it('Example 3: Poisoned Preacher lets preached Minion act again', () => {
			// Wiki: "Doug is the Preacher. He points to Marianna, who is the Pit-Hag. Marianna wakes to
			// learn that she has been preached, and is not woken to use her ability. The following
			// night, the Poisoner points to Doug. Because Doug is now poisoned, Marianna wakes to use
			// her ability."
			const s = scenario(['preacher', 'chef', 'pithag', 'poisoner', 'imp']).reminder(
				'pithag',
				'preacher',
				'No Ability'
			);
			expect(abilityState(s.game, s.seat('pithag'), s.characters).works).toBe(false);
			const next = s.newDay().poisoned('preacher');
			expect(abilityState(next.game, next.seat('pithag'), next.characters).works).toBe(true);
		});
	});
});
