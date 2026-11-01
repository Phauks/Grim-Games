/**
 * Drunk: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Drunk
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Drunk.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { infoPicker, isAllowed, isTruthful, nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Drunk', () => {
	const character = committedCharacter('drunk');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Drunk');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Drunk']);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('drunk')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Drunk#Examples)', () => {
		it("Example 1: Drunk who thinks they're Soldier dies to Imp", () => {
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).drunk('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
		it('Example 2: Drunk Empath gets false numbers two nights', () => {
			// Beside one evil player, the Drunk "Empath" may be told 0, and 1 the next night: any
			// number is allowed, the true one is still worked out.
			const s = scenario(['empath', 'imp', 'chef', 'monk', 'saint']).drunk('empath');
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(picker).toMatchObject({ unreliable: 'drunk', anyAllowed: true, range: { truth: 1 } });
			expect(isAllowed(picker, { seats: [], number: 0 })).toBe(true);
			const next = s.newDay();
			const later = infoPicker(next.game, next.seat('empath'), 'empath', next.characters)!;
			expect(isAllowed(later, { seats: [], number: 1 })).toBe(true);
		});
		it('Example 3: Drunk Ravenkeeper picks Saint, is shown Poisoner', () => {
			const s = scenario(['ravenkeeper', 'saint', 'imp', 'poisoner', 'chef'])
				.drunk('ravenkeeper')
				.dies('ravenkeeper', 'imp');
			const picker = infoPicker(s.game, s.seat('ravenkeeper'), 'ravenkeeper', s.characters)!;
			const shown = { seats: [s.seat('saint')], characterId: 'poisoner' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
		it('Example 4: Drunk Undertaker learns the Drunk was executed', () => {
			// The Fortune Teller was executed; the Drunk "Undertaker" may be told anything.
			const s = scenario(['undertaker', 'fortuneteller', 'imp', 'monk', 'poisoner'])
				.drunk('undertaker')
				.execute('fortuneteller');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'fortuneteller',
				unreliable: 'drunk'
			});
		});
	});
});
