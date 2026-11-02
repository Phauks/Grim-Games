/**
 * Clockmaker: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Clockmaker
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Clockmaker.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isTruthful } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Clockmaker', () => {
	const character = committedCharacter('clockmaker');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Clockmaker');
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

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('clockmaker')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Clockmaker#Examples)', () => {
		it('Example 1: Fang Gu seated beside Pit-Hag: result one', () => {
			// Wiki: "The Fang Gu is sitting next to the Pit-Hag. During the first night, the Clockmaker
			// learns a "1"."
			const s = scenario(['clockmaker', 'fanggu', 'pithag', 'chef', 'empath', 'sweetheart']);
			const picker = infoPicker(s.game, s.seat('clockmaker'), 'clockmaker', s.characters)!;
			expect(picker.range?.truth).toBe(1);
			expect(isTruthful(picker, { seats: [], number: 1 })).toBe(true);
		});

		it('Example 2: Closest Minion sits three seats away', () => {
			// Wiki: "Clockwise from the No Dashii sits the Dreamer, the Snake Charmer, then the Evil Twin.
			// Counterclockwise from the No Dashii sits the Mutant, the Sweetheart, the Philosopher, the
			// Sage, then the Witch. Because the Witch is five steps away from the Demon, and the Evil
			// Twin is three steps away from the Demon, the Clockmaker learns a "3" during the first
			// night."
			// Seating order runs clockwise; the Clockmaker sits between the Evil Twin and the Witch.
			const s = scenario([
				'nodashii',
				'dreamer',
				'snakecharmer',
				'eviltwin',
				'clockmaker',
				'witch',
				'sage',
				'philosopher',
				'sweetheart',
				'mutant'
			]);
			const picker = infoPicker(s.game, s.seat('clockmaker'), 'clockmaker', s.characters)!;
			expect(picker.range?.truth).toBe(3);
		});

		it('Example 3: Evil Travellers excluded; Minion is two away', () => {
			// Wiki: "The Fang Gu neighbours two Travellers, one good and one evil. Neighboring one of these
			// Travellers is a Cerenovus. During the first night, the Clockmaker learns a "2", because
			// evil Travellers are not Minions."
			const s = scenario([
				'clockmaker',
				'chef',
				'cerenovus',
				'scapegoat',
				'fanggu',
				'gunslinger',
				'empath',
				'sweetheart'
			]).do(
				(at) => ({ type: 'SetAlignment', seatId: at.seat('scapegoat'), alignment: 'evil' }),
				(at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' })
			);
			const picker = infoPicker(s.game, s.seat('clockmaker'), 'clockmaker', s.characters)!;
			expect(picker.range?.truth).toBe(2);
		});
	});
});
