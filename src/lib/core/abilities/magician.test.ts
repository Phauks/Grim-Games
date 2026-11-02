/**
 * Magician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Magician
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Magician.
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
import { demonInfo } from '#lib/core/rules/evil-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Magician', () => {
	const character = committedCharacter('magician');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Magician');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('magician')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Magician#Examples)', () => {
		it('Example 1: Minions unsure whether Leviathan or Magician is the Demon', () => {
			// Wiki: "The Minions wake to learn that either the Leviathan player or the Magician player is
			// the Demon. The Leviathan player learns that the Fearmonger player, the Assassin player, and
			// the Magician player are the Minions."
			const s = scenario([
				'magician',
				'fearmonger',
				'assassin',
				'leviathan',
				'chef',
				'empath',
				'monk'
			]);
			expect(demonInfo(s.game, s.characters)).toEqual({
				shownAsMinions: [s.seat('magician')],
				shownAsDemon: [s.seat('magician')]
			});
		});
	});
});
