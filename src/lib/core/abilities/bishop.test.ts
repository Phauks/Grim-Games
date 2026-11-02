/**
 * Bishop: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bishop
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bishop.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { mayNominate } from '#lib/core/rules/nominations.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Bishop', () => {
	const character = committedCharacter('bishop');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Bishop');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Nominate Good', 'Nominate Evil']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('bishop')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bishop#Examples)', () => {
		const table = (alignment: 'good' | 'evil') =>
			scenario(['bishop', 'minstrel', 'chef', 'empath', 'goon', 'poisoner', 'imp']).do((s) => ({
				type: 'SetAlignment',
				seatId: s.seat('bishop'),
				alignment
			}));

		it.fails('Example 1: Good Bishop: day-one nominees include Demon and Minion', () => {
			// Wiki: "The Bishop is good. On the first day, the Storyteller nominates the Demon, a
			// Minion, and two Townsfolk. On the second day, the Storyteller nominates a Minion and
			// Outsider."
			// Only the Storyteller nominates, and each day at least one opposing (evil) player.
			const s = table('good').newDay();
			expect(alignmentOf(s.game, s.seat('bishop'))).toBe('good');
			expect(abilityState(s.game, s.seat('bishop'), s.characters).works).toBe(true);
			engineGap(
				'M9',
				'while the Bishop works, no player may nominate; the Storyteller nominates, at least one evil player a day for a good Bishop'
			);
		});
		it.fails('Example 2: Evil Bishop: a good Minstrel gets nominated', () => {
			// Wiki: "The Bishop is evil. The Storyteller has nominated nobody. However, the
			// Storyteller must nominate at least one good player today, so they choose the Minstrel.
			// The next day, the Storyteller nominates four good players and the Demon. The Bishop is
			// exiled that day, and now the players may continue the nomination process normally."
			// Once the Bishop is exiled, players nominate again.
			const s = table('evil').newDay();
			expect(alignmentOf(s.game, s.seat('bishop'))).toBe('evil');
			const exiled = s.newDay().do((at) => ({ type: 'Exile', seatId: at.seat('bishop') }));
			expect(exiled.game.seats[exiled.seat('bishop')].dead).toBe(true);
			expect(mayNominate(exiled.game, exiled.seat('chef'), exiled.characters)).toBe(true);
			engineGap(
				'M9',
				'while the evil Bishop works, only the Storyteller nominates, at least one good player a day, until the Bishop is exiled'
			);
		});
	});
});
