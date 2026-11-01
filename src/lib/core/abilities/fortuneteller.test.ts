/**
 * Fortune Teller: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fortune_Teller
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fortune Teller.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fortune Teller', () => {
	const character = committedCharacter('fortuneteller');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Fortune Teller');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Red Herring']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('fortuneteller')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fortune_Teller#Examples)', () => {
		it('Example 1: Monk and Undertaker, learns no', () => {
			const s = scenario(['fortuneteller', 'monk', 'undertaker', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(
				isTruthful(picker, { seats: [s.seat('monk'), s.seat('undertaker')], yes: false })
			).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('monk'), s.seat('undertaker')], yes: true })).toBe(
				false
			);
		});

		it('Example 2: Imp and Empath, learns yes', () => {
			const s = scenario(['fortuneteller', 'imp', 'empath', 'monk', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp'), s.seat('empath')], yes: true })).toBe(
				true
			);
		});

		it('Example 3: alive Butler and dead Imp, learns yes', () => {
			// A dead Demon still counts.
			const s = scenario(['fortuneteller', 'butler', 'imp', 'monk', 'poisoner']).dies('imp');
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('butler'), s.seat('imp')], yes: true })).toBe(
				true
			);
		});

		it('Example 4: themselves and the Saint who is the Red Herring, learns yes', () => {
			const s = scenario(['fortuneteller', 'saint', 'imp', 'monk', 'poisoner']).reminder(
				'saint',
				'fortuneteller',
				'Red Herring'
			);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			const chose = [s.seat('fortuneteller'), s.seat('saint')];
			expect(isTruthful(picker, { seats: chose, yes: true })).toBe(true);
		});
	});
});
