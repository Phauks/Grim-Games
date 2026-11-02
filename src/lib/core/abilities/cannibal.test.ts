/**
 * Cannibal: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Cannibal
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Cannibal.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { gainedAbilities, withGainedSteps } from '#lib/core/rules/gained-abilities.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Cannibal', () => {
	const character = committedCharacter('cannibal');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Cannibal');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned', 'Lunch']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('cannibal')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Cannibal#Examples)', () => {
		it.fails('Example 1: Ate Clockmaker: gets a distance number', () => {
			// Wiki: "The Clockmaker is executed and dies. That night, the Cannibal learns a “2” because
			// the Demon and Minion are two steps apart."
			// Waits on the engine: the Cannibal's gained ability doesn't wake them (its gainedFrom
			// rule has no wakes), so no Clockmaker step is added for them that night.
			const s = scenario(['cannibal', 'clockmaker', 'imp', 'chef', 'poisoner'])
				.execute('clockmaker')
				.reminder('clockmaker', 'cannibal', 'Lunch')
				.newDay();
			const picker = infoPicker(s.game, s.seat('cannibal'), 'clockmaker', s.characters)!;
			expect(picker.range?.truth).toBe(2);
			expect(gainedAbilities(s.game, s.characters)).toContainEqual(
				expect.objectContaining({ seatId: s.seat('cannibal'), characterId: 'clockmaker' })
			);
		});
		it('Example 2: Poisoned Cannibal misled after eating Widow', () => {
			// Wiki: "It is the third night and the Widow was executed today. Because the Widow was
			// bluffing as the Fortune Teller, the Cannibal is prompted to choose 2 players, but they
			// learn a “no” after choosing the Demon because they don’t actually have the Fortune
			// Teller's (or Widow’s) ability, because they are poisoned."
			// The Widow was evil, so the Cannibal carries its own Poisoned reminder.
			const s = scenario(['cannibal', 'widow', 'imp', 'chef', 'monk'])
				.execute('widow')
				.reminder('widow', 'cannibal', 'Lunch')
				.reminder('cannibal', 'cannibal', 'Poisoned');
			expect(abilityState(s.game, s.seat('cannibal'), s.characters).works).toBe(false);
			const picker = infoPicker(s.game, s.seat('cannibal'), 'fortuneteller', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			const no = { seats: [s.seat('imp'), s.seat('chef')], yes: false };
			expect(isTruthful(picker, no)).toBe(false);
			expect(isAllowed(picker, no)).toBe(true);
		});
		it('Example 3: Eating Mutant brings no night information', () => {
			// Wiki: "It is the fourth night and the Mutant was executed today. The Cannibal doesn’t
			// learn anything tonight, because a real Mutant would not wake."
			const s = scenario(['cannibal', 'mutant', 'imp', 'chef', 'poisoner'])
				.execute('mutant')
				.reminder('mutant', 'cannibal', 'Lunch')
				.newDay();
			expect(nightSheetPresence('mutant')).toEqual({ firstNight: false, otherNight: false });
			expect(infoPicker(s.game, s.seat('cannibal'), 'mutant', s.characters)).toBeUndefined();
			const steps = withGainedSteps([], s.game, s.characters, 'other');
			expect(steps).toEqual([]);
		});
	});
});
