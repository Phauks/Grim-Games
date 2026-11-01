/**
 * Butler: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Butler
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Butler.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Butler', () => {
	const character = committedCharacter('butler');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Butler');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Master']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('butler')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Butler#Examples)', () => {
		// The Butler's vote rule (votes only while the Master votes) waits on voting in the engine.
		it.fails('Example 1: Butler votes with master, or not at all', () => {
			scenario(['butler', 'chef', 'imp', 'monk', 'poisoner']).reminder('chef', 'butler', 'Master');
			engineGap('M9', "the Butler's hand may be raised only while the Master's is");
		});
		it.fails('Example 2: Master lowers hand late; Butler follows', () => {
			scenario(['butler', 'chef', 'imp', 'monk', 'poisoner'])
				.reminder('chef', 'butler', 'Master')
				.nominate('monk', 'imp');
			engineGap('M9', 'when the Master lowers their hand during the count, the Butler must too');
		});
		it.fails('Example 3: Dead Butler votes freely using their ghost vote', () => {
			// The dead have no ability, so the Butler's rule no longer binds them.
			scenario(['butler', 'chef', 'imp', 'monk', 'poisoner'])
				.reminder('chef', 'butler', 'Master')
				.dies('butler');
			engineGap('M9', 'a dead Butler may spend their vote token without the Master voting');
		});
	});
});
