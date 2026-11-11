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
import { dayUseDeath, dayUseOf, dayUseSuggestion } from '#lib/core/rules/day/day-claims.ts';
import { nominationsLeftThisGame } from '#lib/core/rules/day/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';

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
		it("Example 1: Golem's nominee dies; Golem can't nominate again", () => {
			// Wiki: "The Golem nominates the Poppy Grower. The Poppy Grower dies. The Golem may not
			// nominate again this game."
			const s = scenario(['golem', 'poppygrower', 'imp', 'chef', 'poisoner'])
				.newDay()
				.nominate('golem', 'poppygrower');
			expect(dayUseSuggestion(s.game, s.seat('golem'), 'nominated')).toBe(s.seat('poppygrower'));
			expect(dayUseDeath(s.game, 'golem', s.seat('poppygrower'), s.characters)).toBe('dies');
			const later = s
				.dies('poppygrower', 'golem')
				.reminder('golem', 'golem', 'May Not Nominate')
				.newDay();
			expect(nominationsLeftThisGame(later.game, later.seat('golem'), later.characters)?.left).toBe(
				0
			);
		});
		it('Example 2: Recluse seems Demon; voting still happens', () => {
			// Wiki: "The Golem nominates the Recluse. The Recluse registers as the Demon. Nothing happens,
			// and the Storyteller begins counting votes for the Recluse to be executed. The Golem may not
			// nominate again this game."
			const s = scenario(['golem', 'recluse', 'imp', 'chef', 'poisoner'])
				.newDay()
				.nominate('golem', 'recluse');
			expect(dayUseDeath(s.game, 'golem', s.seat('recluse'), s.characters)).toBe('maybe');
			const later = s.reminder('golem', 'golem', 'May Not Nominate').newDay();
			expect(later.game.seats[later.seat('recluse')].dead).toBe(false);
			expect(nominationsLeftThisGame(later.game, later.seat('golem'), later.characters)?.left).toBe(
				0
			);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Golem#How_to_Run)', () => {
		const cast = ['golem', 'chef', 'imp', 'empath', 'poisoner'];

		it('lets the Golem kill the non-Demon player they nominate', () => {
			// Wiki: "If the Golem nominates a non-Demon, that player dies, then the vote continues as
			// normal."
			const s = scenario(cast).newDay().nominate('golem', 'chef');
			expect(validDeathCauses(s.game, s.seat('chef'), s.characters, { day: true })).toContainEqual(
				expect.objectContaining({ cause: 'golem', flags: [] })
			);
			expect(dayUseDeath(s.game, 'golem', s.seat('chef'), s.characters)).toBe('dies');
		});

		it('does not kill the Demon the Golem nominates', () => {
			// Wiki: "If the Golem nominates the Demon, the vote continues as normal. (Do not say why.)"
			const s = scenario(cast).newDay().nominate('golem', 'imp');
			expect(dayUseDeath(s.game, 'golem', s.seat('imp'), s.characters)).toBe('no');
			expect(s.game.seats[s.seat('imp')].dead).toBe(false);
		});

		it('marks the Golem May Not Nominate once they have nominated, either way', () => {
			// Wiki: "Mark the Golem with the MAY NOT NOMINATE reminder."
			const s = scenario(cast).newDay().nominate('golem', 'imp');
			const spent = { characterId: 'golem', label: 'May Not Nominate' };
			expect(dayUseOf('golem', s.characters)?.spentToken).toBe('May Not Nominate');
			expect(reminderTargetMisses(s.game, spent, s.seat('golem'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});
	});
});
