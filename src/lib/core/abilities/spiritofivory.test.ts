/**
 * Spirit of Ivory: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Spirit_of_Ivory
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Spirit of Ivory.
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
import { dispatch } from '#lib/core/engine/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Spirit of Ivory', () => {
	const character = committedCharacter('spiritofivory');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Spirit of Ivory');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No More Evil']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('spiritofivory')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory#Examples)', () => {
		it.fails('Example 1: Second evil conversion blocked; Goon stays good', () => {
			// Wiki: "The Fang Gu attacks an Outsider and creates an evil player. The Devil's
			// Advocate chooses the Goon at night. Normally, the Goon would turn evil, but the Goon
			// remains good because there is already 1 more evil character than normal in play."
			// Waits on the engine: the extra evil count only counts evil Townsfolk and Outsiders, so
			// the Outsider the Fang Gu turned into an evil Demon is not counted, and turning the
			// Goon evil gives no warning.
			const cast = ['fanggu', 'butler', 'devilsadvocate', 'goon', 'chef', 'empath', 'monk'];
			const s = scenario(cast)
				.rule('spiritofivory')
				.dies('fanggu', 'fanggu')
				.becomes('butler', 'fanggu', 'evil');
			const result = dispatch(
				s.session,
				{ type: 'SetAlignment', seatId: s.seat('goon'), alignment: 'evil' },
				s.ctx
			);
			expect(result.ok && result.warnings.map((w) => w.code)).toEqual(['extra-evil-limit']);
		});
	});
});
