/**
 * Thief: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Thief
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Thief.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Thief', () => {
	const character = committedCharacter('thief');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Thief');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Negative Vote']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('thief')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'vote', name: 'multiplier', value: -1 }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Thief#Examples)', () => {
		// Vote weight (the Negative Vote token) waits on voting in the engine.
		it.fails('Example 1: Negative vote; nominee still reaches five', () => {
			scenario(['thief', 'chef', 'imp', 'monk', 'poisoner', 'empath', 'saint'])
				.reminder('chef', 'thief', 'Negative Vote')
				.newDay();
			engineGap('M9', "a vote tally counts the Negative Vote player's raised hand as minus one");
		});
		it.fails('Example 2: Negative vote blocks execution; exile counts positively', () => {
			// Ten alive need five; a tally of four executes nobody. An exile vote is not affected.
			scenario([
				'thief',
				'chef',
				'imp',
				'monk',
				'poisoner',
				'empath',
				'saint',
				'mayor',
				'soldier',
				'gunslinger'
			])
				.reminder('chef', 'thief', 'Negative Vote')
				.newDay();
			engineGap('M9', 'the negative vote counts on nominations for execution, but not on exiles');
		});
	});
});
