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
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
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
			const s = scenario(['chef', 'imp', 'empath', 'poisoner', 'monk']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(0);
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
		});

		it('Example 2: two separate evil pairs, learns two', () => {
			const s = scenario(['chef', 'imp', 'baron', 'monk', 'poisoner', 'scarletwoman', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range?.truth).toBe(2);
		});

		it('Example 3: evil Traveller between Imp and Minion, plus a Minion pair, learns three', () => {
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

		it.fails('Example 4: Recluse between Imp and Poisoner, learns one', () => {
			// The Recluse may register as evil for one pair and good for the other in the same
			// count. Waits on the engine: a registration is one world for the whole count, so only
			// 0 (both good) or 2 (both evil) is offered.
			const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk', 'empath']);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
		});
	});
});
