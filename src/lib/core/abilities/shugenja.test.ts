/**
 * Shugenja: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Shugenja
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Shugenja.
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

describe('Shugenja', () => {
	const character = committedCharacter('shugenja');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Shugenja');
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
			expect(nightSheetPresence('shugenja')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Shugenja#Examples)', () => {
		it('Example 1: Nearest evil lies clockwise, two seats away', () => {
			// Wiki: "The Organ Grinder is 2 steps away from the Shugenja in a clockwise direction. The
			// Fearmonger is 3 steps away from the Shugenja in an anti-clockwise direction. The
			// Shugenja wakes and learns that the closest evil player is in a clockwise direction."
			// Clockwise is the next seat on; the Demon sits 4 steps away either way.
			const s = scenario([
				'shugenja',
				'chef',
				'organgrinder',
				'empath',
				'vigormortis',
				'fearmonger',
				'monk',
				'mayor'
			]);
			const picker = infoPicker(s.game, s.seat('shugenja'), 'shugenja', s.characters)!;
			expect(isTruthful(picker, { seats: [], yes: true })).toBe(true);
			expect(isAllowed(picker, { seats: [], yes: false })).toBe(false);
		});
		it('Example 2: Tied evil neighbours; Storyteller picks the direction', () => {
			// Wiki: "The Marionette is 1 step away from the Shugenja in a clockwise direction. The
			// Widow is 1 step away from the Shugenja in an anti-clockwise direction. The Shugenja
			// wakes and the Storyteller chooses to tell the Shugenja that the closest evil player is in
			// a clockwise direction."
			const s = scenario(['shugenja', 'marionette', 'chef', 'imp', 'empath', 'widow']);
			const picker = infoPicker(s.game, s.seat('shugenja'), 'shugenja', s.characters)!;
			expect(isTruthful(picker, { seats: [], yes: true })).toBe(true);
			expect(isTruthful(picker, { seats: [], yes: false })).toBe(true);
		});
	});
});
