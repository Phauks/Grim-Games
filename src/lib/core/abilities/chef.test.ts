/**
 * Chef: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Chef
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Chef.
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

describe('Chef', () => {
	const character = committedCharacter('chef');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Chef');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('chef')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Chef#Examples)', () => {
		it('Example 1: no evil neighbours, learns zero', () => {
			// Wiki: "No evil players are sitting next to each other. The Chef learns a '0'."
			const s = scenario(['chef', 'imp', 'empath', 'poisoner', 'monk']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(0);
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
		});

		it('Example 2: two separate evil pairs, learns two', () => {
			// Wiki: "The Imp is sitting next to the Baron. Across the circle, the Poisoner is sitting next
			// to the Scarlet Woman. The Chef learns a '2'."
			const s = scenario(['chef', 'imp', 'baron', 'monk', 'poisoner', 'scarletwoman', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(2);
		});

		it('Example 3: evil Traveller between Imp and Minion, plus a Minion pair, learns three', () => {
			// Wiki: "An evil Scapegoat is sitting between the Imp and a Minion. Across the circle, two
			// other Minions are sitting next to each other. The Chef learns a '3'."
			// An evil Traveller counts as evil: Imp, Scapegoat and Poisoner make two pairs.
			const s = scenario([
				'chef',
				'imp',
				'scapegoat',
				'poisoner',
				'monk',
				'scarletwoman',
				'baron',
				'empath'
			]).do((at) => ({ type: 'SetAlignment', seatId: at.seat('scapegoat'), alignment: 'evil' }));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(3);
		});

		it('Example 4: Recluse between Imp and Poisoner, learns one', () => {
			// Wiki: "The Recluse is sitting between the Imp and the Poisoner. The Chef learns a '1'. Here,
			// the Recluse is registering as evil for the Imp-Recluse pair, but as good for the
			// Poisoner-Recluse pair."
			// The Recluse may register as evil for one pair and good for the other in the same
			// count.
			const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
		});
	});
});
