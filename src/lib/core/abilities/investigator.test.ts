/**
 * Investigator: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Investigator
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Investigator.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, isAllowed, isTruthful, learnedRoles } from '#lib/core/rules/night-info.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Investigator', () => {
	const character = committedCharacter('investigator');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Investigator');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Minion', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('investigator')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Investigator#Examples)', () => {
		it('Example 1: Baron is one of two players', () => {
			// Wiki: "Amy is the Baron, and Julian is the Mayor. The Investigator learns that either Amy or
			// Julian is the Baron."
			const s = scenario(['investigator', 'baron', 'mayor', 'imp', 'saint', 'butler', 'chef']);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('baron'), s.seat('mayor')], characterId: 'baron' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: Spy is one of two Minions shown', () => {
			// Wiki: "Angelus is the Spy, and Lewis is the Poisoner. The Investigator learns that either
			// Angelus or Lewis is the Spy."
			// Both players shown may be Minions.
			const s = scenario([
				'investigator',
				'spy',
				'poisoner',
				'imp',
				'chef',
				'monk',
				'empath',
				'mayor',
				'slayer',
				'soldier'
			]);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('spy'), s.seat('poisoner')], characterId: 'spy' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 3: Recluse registers as the Poisoner', () => {
			// Wiki: "Brianna is the Recluse, and Marianna is the Imp. The Investigator learns that either
			// Brianna or Marianna is the Poisoner. (This happens because the Recluse is registering as a
			// Minion—in this case, the Poisoner.)"
			// The Recluse may register as a Minion; neither player shown is really one.
			const s = scenario(['investigator', 'recluse', 'imp', 'chef', 'monk', 'scarletwoman']);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('recluse'), s.seat('imp')], characterId: 'poisoner' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Investigator#How_to_Run)', () => {
		const cast = ['investigator', 'poisoner', 'chef', 'imp', 'monk'];
		const marked = (s: Scenario) =>
			s.reminder('poisoner', 'investigator', 'Minion').reminder('chef', 'investigator', 'Wrong');

		it('lists the Minion and Wrong reminders to place before the first night', () => {
			// How to Run: before night one, the Storyteller marks one Minion with Minion and a
			// second player with Wrong.
			const s = scenario(cast);
			expect(setupPrep('investigator', character.name, s.characters).map((p) => p.tokens)).toEqual([
				['Minion'],
				['Wrong']
			]);
		});

		it('puts the Minion reminder only on a Minion', () => {
			// How to Run: the Minion reminder goes beside a Minion's character token.
			const s = scenario(cast);
			const reminder = { characterId: 'investigator', label: 'Minion' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('poisoner'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('chef'), s.characters)).toEqual([
				'type'
			]);
		});

		it('puts the Wrong reminder on any other seat, never the one marked Minion', () => {
			// How to Run: the Wrong reminder goes beside a different character token.
			const s = scenario(cast).reminder('poisoner', 'investigator', 'Minion');
			const reminder = { characterId: 'investigator', label: 'Wrong' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('poisoner'), s.characters)).toEqual([
				'not-with-label'
			]);
		});

		it('on the first night, shows the two marked players and the marked character', () => {
			// How to Run: on night one, point at the seats marked Minion and Wrong, and show the
			// character marked Minion.
			const s = marked(scenario(cast));
			const picker = infoPicker(
				s.game,
				s.seat('investigator'),
				'investigator',
				s.characters,
				'first'
			)!;
			expect(picker.seatCount).toBe(2);
			expect(learnedRoles(s.game, picker, s.characters)?.rows[0]).toMatchObject({
				target: s.seat('poisoner'),
				other: s.seat('chef'),
				characterIds: ['poisoner'],
				marked: true
			});
		});

		it('lets the Storyteller remove both reminders once they are shown', () => {
			// How to Run: the reminders come off whenever it suits the Storyteller.
			const s = marked(scenario(cast)).newDay();
			const ids = s.game.seating.flatMap((id) =>
				s.game.seats[id].reminders
					.filter((r) => r.characterId === 'investigator')
					.map((r) => r.reminderId)
			);
			expect(ids).toHaveLength(2);
			const cleared = s.do(
				...ids.map((reminderId) => ({ type: 'RemoveReminder' as const, reminderId }))
			);
			const picker = infoPicker(
				cleared.game,
				cleared.seat('investigator'),
				'investigator',
				cleared.characters,
				'first'
			)!;
			expect(
				learnedRoles(cleared.game, picker, cleared.characters)?.rows.some((r) => r.marked)
			).toBe(false);
		});
	});
});
