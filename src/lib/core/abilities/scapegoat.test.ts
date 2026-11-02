/**
 * Scapegoat: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Scapegoat
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Scapegoat.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { executedInstead } from '#lib/core/rules/executed-instead.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Scapegoat', () => {
	const character = committedCharacter('scapegoat');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Scapegoat');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('scapegoat')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Scapegoat#Examples)', () => {
		const table = (alignment: 'good' | 'evil') =>
			scenario(['fortuneteller', 'undertaker', 'poisoner', 'spy', 'imp', 'scapegoat']).becomes(
				'scapegoat',
				'scapegoat',
				alignment
			);

		it('Example 1: Scapegoat dies so the Fortune Teller survives', () => {
			// Wiki: "The Fortune Teller is about to be executed, but the Storyteller chooses to execute
			// the good Scapegoat instead. The Fortune Teller lives and the Scapegoat dies. That night, the
			// Undertaker learns that a Scapegoat was executed today."
			const s = table('good');
			expect(executedInstead(s.game, s.seat('fortuneteller'), s.characters)).toEqual([
				{ seatId: s.seat('scapegoat'), characterId: 'scapegoat' }
			]);
			const after = s.execute('scapegoat');
			expect(after.game.seats[after.seat('scapegoat')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
			expect(after.game.seats[after.seat('fortuneteller')].dead).toBe(false);
		});

		it('Example 2: Evil Scapegoat dies instead of Poisoner', () => {
			// Wiki: "The Poisoner is about to be executed, but the Storyteller chooses to execute the evil
			// Scapegoat instead. The Storyteller could have let the Poisoner die as normal, but chose not
			// to."
			// An evil Scapegoat may die for an evil player; never for a good one.
			const s = table('evil');
			expect(executedInstead(s.game, s.seat('poisoner'), s.characters)).toHaveLength(1);
			expect(executedInstead(s.game, s.seat('fortuneteller'), s.characters)).toEqual([]);
		});

		it('Example 3: Good Scapegoat dies instead of the Spy', () => {
			// Wiki: "The Spy is about to be executed. The good Scapegoat dies instead."
			// The Spy might register as good, so a good Scapegoat may die in its place; not for the
			// Imp, who is plainly evil.
			const s = table('good');
			expect(executedInstead(s.game, s.seat('spy'), s.characters)).toHaveLength(1);
			expect(executedInstead(s.game, s.seat('imp'), s.characters)).toEqual([]);
		});
	});
});
