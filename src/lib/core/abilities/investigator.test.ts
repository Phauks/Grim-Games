/**
 * Investigator: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Investigator
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Investigator.
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

describe('Investigator', () => {
	const character = committedCharacter('investigator');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Investigator');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Minion', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('investigator')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Investigator#Examples)', () => {
		it('Example 1: Baron is one of two players', () => {
			// Wiki: "Amy is the Baron, and Julian is the Mayor. The Investigator learns that either Amy or
			// Julian is the Baron."
			const s = scenario(['investigator', 'baron', 'mayor', 'imp', 'saint', 'butler', 'chef']);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('baron'), s.seat('mayor')], characterId: 'baron' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: Spy is one of two Minions shown', () => {
			// Wiki: "Angelus is the Spy, and Lewis is the Poisoner. The Investigator learns that either
			// Angelus or Lewis is the Spy."
			// Both players shown may be Minions.
			const s = scenario([
				'investigator',
				'spy',
				'poisoner',
				'imp',
				'chef',
				'monk',
				'empath',
				'mayor',
				'slayer',
				'soldier'
			]);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('spy'), s.seat('poisoner')], characterId: 'spy' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 3: Recluse registers as the Poisoner', () => {
			// Wiki: "Brianna is the Recluse, and Marianna is the Imp. The Investigator learns that either
			// Brianna or Marianna is the Poisoner. (This happens because the Recluse is registering as a
			// Minion—in this case, the Poisoner.)"
			// The Recluse may register as a Minion; neither player shown is really one.
			const s = scenario(['investigator', 'recluse', 'imp', 'chef', 'monk', 'scarletwoman']);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('recluse'), s.seat('imp')], characterId: 'poisoner' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
	});
});
