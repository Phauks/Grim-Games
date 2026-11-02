/**
 * Golem: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Golem
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Golem.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { dayUseDeath, dayUseSuggestion } from '#lib/core/rules/day-claims.ts';
import { mayNominate } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Golem', () => {
	const character = committedCharacter('golem');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Golem');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['May Not Nominate']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('golem')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Golem#Examples)', () => {
		it.fails("Example 1: Golem's nominee dies; Golem can't nominate again", () => {
			// Wiki: "The Golem nominates the Poppy Grower. The Poppy Grower dies. The Golem may not
			// nominate again this game."
			// Waits on the engine (M9): mayNominate ignores the Golem's one nomination per game.
			const s = scenario(['golem', 'poppygrower', 'imp', 'chef', 'poisoner'])
				.newDay()
				.nominate('golem', 'poppygrower');
			expect(dayUseSuggestion(s.game, s.seat('golem'), 'nominated')).toBe(s.seat('poppygrower'));
			expect(dayUseDeath(s.game, 'golem', s.seat('poppygrower'), s.characters)).toBe('dies');
			const later = s
				.dies('poppygrower', 'golem')
				.reminder('golem', 'golem', 'May Not Nominate')
				.newDay();
			expect(mayNominate(later.game, later.seat('golem'), later.characters)).toBe(false);
		});
		it.fails('Example 2: Recluse seems Demon; voting still happens', () => {
			// Wiki: "The Golem nominates the Recluse. The Recluse registers as the Demon. Nothing happens,
			// and the Storyteller begins counting votes for the Recluse to be executed. The Golem may not
			// nominate again this game."
			// Waits on the engine (M9): dayUseDeath says the Recluse dies, missing that they might register
			// as the Demon; and, as in Example 1, mayNominate ignores the Golem's one nomination.
			const s = scenario(['golem', 'recluse', 'imp', 'chef', 'poisoner'])
				.newDay()
				.nominate('golem', 'recluse');
			expect(dayUseDeath(s.game, 'golem', s.seat('recluse'), s.characters)).toBe('maybe');
			const later = s.reminder('golem', 'golem', 'May Not Nominate').newDay();
			expect(later.game.seats[later.seat('recluse')].dead).toBe(false);
			expect(mayNominate(later.game, later.seat('golem'), later.characters)).toBe(false);
		});
	});
});
