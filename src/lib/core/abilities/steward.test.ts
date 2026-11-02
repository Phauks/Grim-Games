/**
 * Steward: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Steward
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Steward.
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
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Steward', () => {
	const character = committedCharacter('steward');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Steward');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('steward')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Steward#Examples)', () => {
		it('Example 1: Steward learns good ally is Undertaker', () => {
			// Wiki: "The Steward learns that Alex is good. Alex is the Undertaker."
			const s = scenario(['steward', 'undertaker', 'chef', 'poisoner', 'imp']);
			const picker = infoPicker(s.game, s.seat('steward'), 'steward', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('undertaker')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('poisoner')] })).toBe(false);
		});
		it('Example 2: Hag-created Steward sees Spy seeming good', () => {
			// Wiki: "The Pit-Hag turns the Poppy Grower into the Steward.
			// That night, the Steward learns that Abdallah is good. Abdallah is the Spy, and is
			// registering as good."
			const s = scenario(['poppygrower', 'spy', 'chef', 'pithag', 'imp'])
				.newDay()
				.becomes('poppygrower', 'steward');
			const picker = infoPicker(s.game, s.seat('poppygrower'), 'steward', s.characters)!;
			expect(isAllowed(picker, { seats: [s.seat('spy')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('imp')] })).toBe(false);
		});
	});
});
