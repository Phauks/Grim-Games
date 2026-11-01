/**
 * Empath: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Empath
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Empath.
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

describe('Empath', () => {
	const character = committedCharacter('empath');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Empath');
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

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('empath')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Empath#Examples)', () => {
		it('Example 1: neighbours change as players die', () => {
			// Two good neighbours give 0. With both dead, the next living neighbours are a Librarian
			// and an evil Traveller: 1. With only the Empath, Imp and Baron alive: 2.
			const cast = ['empath', 'soldier', 'librarian', 'imp', 'baron', 'gunslinger', 'monk'];
			const s = scenario(cast).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('gunslinger'),
				alignment: 'evil'
			}));
			const count = (at: typeof s) =>
				infoPicker(at.game, at.seat('empath'), 'empath', at.characters)!.range?.truth;
			expect(count(s)).toBe(0);
			const later = s.execute('soldier').newDay().dies('monk', 'imp');
			expect(count(later)).toBe(1);
			const end = later.dies('librarian').dies('gunslinger');
			expect(count(end)).toBe(2);
			const picker = infoPicker(end.game, end.seat('empath'), 'empath', end.characters)!;
			expect(isTruthful(picker, { seats: [], number: 2 })).toBe(true);
		});
	});
});
