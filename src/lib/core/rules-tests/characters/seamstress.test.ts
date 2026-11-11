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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { wokeTonight } from '#lib/core/rules/woke-tonight.ts';
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
			// Wiki: "During the first night, the Seamstress chooses two players, who are the Barber and the
			// Clockmaker. Because they are both good, the Seamstress learns a "yes.”"
			// The Seamstress picks two good players on the first night: the true answer is yes.
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters)!;
			const pair = [s.seat('chef'), s.seat('monk')];
			expect(isTruthful(picker, { seats: pair, yes: true })).toBe(true);
			expect(isAllowed(picker, { seats: pair, yes: false })).toBe(false);
		});

		it('Example 2: Mixed pair on night four reads no', () => {
			// Wiki: "During the first three nights, the Seamstress chooses not to use their ability. During
			// the fourth night, they choose two players, who are the Fang Gu and the Sweetheart. The
			// Seamstress learns a "no.”"
			// A good player and an evil player differ, whichever night the Seamstress asks.
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters)!;
			const pair = [s.seat('monk'), s.seat('imp')];
			expect(isTruthful(picker, { seats: pair, yes: false })).toBe(true);
			expect(isAllowed(picker, { seats: pair, yes: true })).toBe(false);
		});

		it("Example 3: Pit-Hag's changed Witch still reads same alignment", () => {
			// Wiki: "The Pit-Hag turns the Mathematician into the Witch, who remains good. Later that night,
			// the Seamstress chooses the two players, the Witch and the Town Crier. The Seamstress learns a
			// "yes" because they are both good."
			const s = scenario(['seamstress', 'mathematician', 'towncrier', 'pithag', 'imp']).becomes(
				'mathematician',
				'witch'
			);
			expect(s.game.seats[s.seat('mathematician')].alignment).toBe('good');
			const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters)!;
			const pair = [s.seat('mathematician'), s.seat('towncrier')];
			expect(isTruthful(picker, { seats: pair, yes: true })).toBe(true);
			expect(isAllowed(picker, { seats: pair, yes: false })).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Seamstress#How_to_Run)', () => {
		it('chooses two players other than themself, on the first night and other nights', () => {
			// Wiki: "Each night, wake the Seamstress. They either shake their head no or point at any two
			// players except themself."
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			for (const night of ['first', 'other'] as const) {
				const picker = infoPicker(s.game, s.seat('seamstress'), 'seamstress', s.characters, night)!;
				expect(picker.seatCount).toBe(2);
				expect(
					isAllowed(picker, { seats: [s.seat('seamstress'), s.seat('chef')], yes: true })
				).toBe(false);
			}
		});

		it('places No Ability on the Seamstress once they have asked', () => {
			// Wiki: "The Seamstress loses their ability - mark them with the NO ABILITY reminder and remove
			// their night token from the night sheet."
			const place = [{ tokens: [{ label: 'No Ability', action: 'place' }] }];
			expect(placeholdersFor(character, 'first')).toEqual(place);
			expect(placeholdersFor(character, 'other')).toEqual(place);
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']);
			const spent = { characterId: 'seamstress', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, spent, s.seat('seamstress'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('no longer wakes once marked No Ability', () => {
			// Wiki: "The Seamstress loses their ability - mark them with the NO ABILITY reminder and remove
			// their night token from the night sheet."
			const s = scenario(['seamstress', 'chef', 'monk', 'imp', 'poisoner']).newDay();
			expect(wokeTonight(s.game, s.seat('seamstress'), s.characters, 'other')).toBe(true);
			const spent = s.reminder('seamstress', 'seamstress', 'No Ability');
			expect(wokeTonight(spent.game, spent.seat('seamstress'), spent.characters, 'other')).toBe(
				false
			);
		});
	});
});
