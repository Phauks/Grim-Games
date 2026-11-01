/**
 * Librarian: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Librarian
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Librarian.
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

describe('Librarian', () => {
	const character = committedCharacter('librarian');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Librarian');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Outsider', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('librarian')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Librarian#Examples)', () => {
		it('Example 1: Saint is one of two players', () => {
			const s = scenario(['librarian', 'saint', 'baron', 'imp', 'chef', 'butler', 'monk']);
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			const shown = { seats: [s.seat('saint'), s.seat('baron')], characterId: 'saint' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: no Outsiders, so learns zero', () => {
			const s = scenario(['librarian', 'chef', 'empath', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			expect(isTruthful(picker, { seats: [], none: true })).toBe(true);
		});

		it('Example 3: Drunk who thinks they are the Monk is shown as the Drunk', () => {
			// The Librarian learns true characters, and the Drunk is the true one.
			const s = scenario(['librarian', 'monk', 'undertaker', 'imp', 'poisoner']).drunk('monk');
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			const shown = { seats: [s.seat('monk'), s.seat('undertaker')], characterId: 'drunk' };
			expect(isTruthful(picker, shown)).toBe(true);
			expect(isAllowed(picker, { seats: [], none: true })).toBe(false);
		});
	});
});
