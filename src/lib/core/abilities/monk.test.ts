/**
 * Monk: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Monk
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Monk.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { starPass } from '#lib/core/rules/game-end.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Monk', () => {
	const character = committedCharacter('monk');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Monk');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Safe']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('monk')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Monk#Examples)', () => {
		it("Example 1: Monk shields Fortune Teller from Imp's attack", () => {
			const s = scenario(['monk', 'fortuneteller', 'imp', 'chef', 'poisoner'])
				.reminder('fortuneteller', 'monk', 'Safe')
				.reminder('fortuneteller', 'imp', 'Dead');
			expect(protection(s.game, s.seat('fortuneteller'), s.characters, 'demon')).toMatchObject({
				characterId: 'monk',
				seatId: s.seat('monk')
			});
			expect(preventedDeaths(s.game, s.characters).map((p) => p.seatId)).toEqual([
				s.seat('fortuneteller')
			]);
		});
		it('Example 2: Imp targets protected Mayor; no deaths', () => {
			// The Mayor is safe from the Imp, so the Mayor's "another player dies" never comes up.
			const s = scenario(['monk', 'mayor', 'imp', 'chef', 'poisoner'])
				.reminder('mayor', 'monk', 'Safe')
				.reminder('mayor', 'imp', 'Dead');
			const [survivor] = preventedDeaths(s.game, s.characters);
			expect(survivor.because.map((b) => b.kind)).toEqual(['protected']);
		});
		it('Example 3: Imp self-kills under protection, staying alive', () => {
			// The protected Imp doesn't die, so no Minion becomes the Imp.
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
				.reminder('imp', 'monk', 'Safe')
				.reminder('imp', 'imp', 'Dead');
			expect(protection(s.game, s.seat('imp'), s.characters, 'demon')).toMatchObject({
				characterId: 'monk'
			});
			expect(starPass(s.game, s.characters)).toBeUndefined();
		});
	});
});
