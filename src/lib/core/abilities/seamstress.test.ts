/**
 * Seamstress: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Seamstress
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Seamstress.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Seamstress', () => {
	const character = committedCharacter('seamstress');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Seamstress');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('seamstress')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Seamstress#Examples)', () => {
		it('Example 1: Two good players checked night one: yes', () => {
			// The Seamstress picks two good players on the first night: the true answer is yes.
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters)!;
			const pair = [s.seat('chef'), s.seat('monk')];
			expect(isTruthful(picker, { seats: pair, yes: true })).toBe(true);
			expect(isAllowed(picker, { seats: pair, yes: false })).toBe(false);
		});

		it('Example 2: Mixed pair on night four reads no', () => {
			// A good player and an evil player differ, whichever night the Seamstress asks.
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters)!;
			const pair = [s.seat('monk'), s.seat('imp')];
			expect(isTruthful(picker, { seats: pair, yes: false })).toBe(true);
			expect(isAllowed(picker, { seats: pair, yes: true })).toBe(false);
		});
		it.todo("Example 3: Pit-Hag's changed Witch still reads same alignment");
	});
});
