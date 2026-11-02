/**
 * Barista: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Barista
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Barista.
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
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Barista', () => {
	const character = committedCharacter('barista');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Barista');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Sober & Healthy', 'Acts Twice', '?', '?']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('barista')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Barista#Examples)', () => {
		it('Example 1: Barista makes Sage sober and healthy', () => {
			// Wiki: "The Barista makes the Sage sober and healthy."
			const s = scenario(['barista', 'sage', 'imp', 'poisoner', 'chef']).poisoned('sage');
			expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(false);
			const sober = s.reminder('sage', 'barista', 'Sober & Healthy');
			expect(abilityState(sober.game, sober.seat('sage'), sober.characters).works).toBe(true);
		});

		it.fails('Example 2: Klutz acts twice, then Witch curses twice', () => {
			// Wiki: "The Klutz acts twice. They die and must choose two players. If either is evil, evil
			// wins. The next night, the Barista makes the Witch act twice. Two players are cursed."
			const s = scenario(['barista', 'klutz', 'witch', 'imp', 'chef', 'empath']).reminder(
				'klutz',
				'barista',
				'Acts Twice'
			);
			expect(
				reminderTargetMisses(
					s.game,
					{ characterId: 'barista', label: '?' },
					s.seat('klutz'),
					s.characters
				)
			).toEqual([]);
			engineGap(
				'unplanned',
				'a player acting twice uses their ability twice: the Klutz chooses two players, the Witch curses two'
			);
		});
	});
});
