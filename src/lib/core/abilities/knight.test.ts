/**
 * Knight: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Knight
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Knight.
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
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Knight', () => {
	const character = committedCharacter('knight');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Knight');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('knight')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Knight#Examples)', () => {
		it('Example 1: Knight learns Undertaker and Fortune Teller players', () => {
			// Wiki: "Lewis is the Undertaker, Doug is the Imp and Ben is the Fortune Teller. The Knight
			// learns Lewis and Ben."
			// Two players who are not the Demon; a pair with the Demon is not allowed.
			const s = scenario(['knight', 'undertaker', 'imp', 'fortuneteller', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('knight'), 'knight', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('undertaker'), s.seat('fortuneteller')] })).toBe(
				true
			);
			expect(isAllowed(picker, { seats: [s.seat('undertaker'), s.seat('imp')] })).toBe(false);
		});

		it("Example 2: Vortox forces the Knight's info to include the Demon", () => {
			// Wiki: "Marianna is the Vortox and Abdallah is the Alchemist. The Knight learns Marianna and
			// Abdallah. The Knight must learn Marianna and Abdallah because the Knight's information must
			// be false due to the Vortox ability and therefore include the Demon."
			const s = scenario(['knight', 'alchemist', 'vortox', 'chef', 'witch']);
			const picker = infoPicker(s.game, s.seat('knight'), 'knight', s.characters)!;
			expect(isAllowed(picker, { seats: [s.seat('vortox'), s.seat('alchemist')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('alchemist'), s.seat('chef')] })).toBe(false);
		});
	});
});
