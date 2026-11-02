/**
 * Noble: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Noble
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Noble.
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

describe('Noble', () => {
	const character = committedCharacter('noble');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Noble');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know', 'Know', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('noble')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Noble#Examples)', () => {
		it('Example 1: Noble gets two good, one evil', () => {
			// Wiki: "The Noble is shown Marianna, Alex, and Abdallah. Marianna and Abdallah are good, and
			// Alex is evil."
			const s = scenario(['noble', 'chef', 'poisoner', 'empath', 'monk', 'imp']);
			const picker = infoPicker(s.game, s.seat('noble'), 'noble', s.characters)!;
			const trio = [s.seat('chef'), s.seat('poisoner'), s.seat('empath')];
			expect(isTruthful(picker, { seats: trio })).toBe(true);
			// Two evil players among the three is not the Noble's information.
			const twoEvil = [s.seat('chef'), s.seat('poisoner'), s.seat('imp')];
			expect(isAllowed(picker, { seats: twoEvil })).toBe(false);
		});
		it('Example 2: Recluse shows up evil to Noble', () => {
			// Wiki: "The Noble learns Doug, Lachlan and Ben. Doug is the Chambermaid. Lachlan is the
			// Barber. Ben is the Recluse, who has registered as evil to the Noble."
			const s = scenario(['noble', 'chambermaid', 'barber', 'recluse', 'poisoner', 'imp']);
			const picker = infoPicker(s.game, s.seat('noble'), 'noble', s.characters)!;
			const trio = { seats: [s.seat('chambermaid'), s.seat('barber'), s.seat('recluse')] };
			expect(isAllowed(picker, trio)).toBe(true);
			expect(isTruthful(picker, trio)).toBe(false);
		});
		it('Example 3: Amy becomes Noble; Spy registers as good', () => {
			// Wiki: "On the third night, the Pit-Hag turns Amy into the Noble. Amy learns that 1 of Evin,
			// Sarah, or Julian is evil. However, Sarah is the evil Spy and has registered as good, and
			// Julian is the Po, who is also evil."
			const s = scenario(['chef', 'empath', 'spy', 'po', 'pithag', 'monk'])
				.newDay()
				.newDay()
				.becomes('chef', 'noble');
			const picker = infoPicker(s.game, s.seat('chef'), 'noble', s.characters)!;
			const trio = { seats: [s.seat('empath'), s.seat('spy'), s.seat('po')] };
			expect(isAllowed(picker, trio)).toBe(true);
			expect(isTruthful(picker, trio)).toBe(false);
		});
	});
});
