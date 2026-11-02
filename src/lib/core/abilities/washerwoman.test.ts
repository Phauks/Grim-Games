/**
 * Washerwoman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Washerwoman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Washerwoman.
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

describe('Washerwoman', () => {
	const character = committedCharacter('washerwoman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Washerwoman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Townsfolk', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('washerwoman')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Washerwoman#Examples)', () => {
		it('Example 1: Chef is one of two named players', () => {
			// Wiki: "Evin is the Chef, and Amy is the Ravenkeeper. The Washerwoman learns that either Evin
			// or Amy is the Chef."
			// Shown the Chef and the Ravenkeeper's players, as the Chef: true.
			const s = scenario(['washerwoman', 'chef', 'ravenkeeper', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('chef'), s.seat('ravenkeeper')], characterId: 'chef' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: Virgin is one of two players', () => {
			// Wiki: "Julian is the Imp, and Alex is the Virgin. The Washerwoman learns that either Julian
			// or Alex is the Virgin."
			// The other player shown may be anyone, even the Imp.
			const s = scenario(['washerwoman', 'imp', 'virgin', 'monk', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('imp'), s.seat('virgin')], characterId: 'virgin' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 3: Spy masquerades as Ravenkeeper alongside another player', () => {
			// Wiki: "Marianna is the Spy, and Sarah is the Scarlet Woman. The Washerwoman learns that one
			// of them is the Ravenkeeper. Here, the Spy is registering as a Townsfolk—in this case, the
			// Ravenkeeper."
			const s = scenario(['washerwoman', 'spy', 'scarletwoman', 'imp', 'chef']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('spy'), s.seat('scarletwoman')], characterId: 'ravenkeeper' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Washerwoman#How_to_Run)', () => {
		const cast = ['washerwoman', 'chef', 'ravenkeeper', 'imp', 'poisoner'];
		const marked = (s: Scenario) =>
			s.reminder('chef', 'washerwoman', 'Townsfolk').reminder('imp', 'washerwoman', 'Wrong');

		it('lists the Townsfolk and Wrong reminders to place before the first night', () => {
			// How to Run: before night one, the Storyteller marks one Townsfolk with Townsfolk and a
			// second player with Wrong.
			const s = scenario(cast);
			expect(setupPrep('washerwoman', character.name, s.characters).map((p) => p.tokens)).toEqual([
				['Townsfolk'],
				['Wrong']
			]);
		});

		it('puts the Townsfolk reminder only on a Townsfolk', () => {
			// How to Run: the Townsfolk reminder goes beside a Townsfolk's character token.
			const s = scenario(cast);
			const reminder = { characterId: 'washerwoman', label: 'Townsfolk' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('imp'), s.characters)).toEqual(['type']);
		});

		it('puts the Wrong reminder on any other seat, never the one marked Townsfolk', () => {
			// How to Run: the Wrong reminder goes beside a different character token.
			const s = scenario(cast).reminder('chef', 'washerwoman', 'Townsfolk');
			const reminder = { characterId: 'washerwoman', label: 'Wrong' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('imp'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('chef'), s.characters)).toEqual([
				'not-with-label'
			]);
		});

		it('on the first night, shows the two marked players and the marked character', () => {
			// How to Run: on night one, point at the seats marked Townsfolk and Wrong, and show the
			// character marked Townsfolk.
			const s = marked(scenario(cast));
			const picker = infoPicker(
				s.game,
				s.seat('washerwoman'),
				'washerwoman',
				s.characters,
				'first'
			)!;
			expect(picker.seatCount).toBe(2);
			expect(learnedRoles(s.game, picker, s.characters)?.rows[0]).toMatchObject({
				target: s.seat('chef'),
				other: s.seat('imp'),
				characterIds: ['chef'],
				marked: true
			});
		});

		it('lets the Storyteller remove both reminders once they are shown', () => {
			// How to Run: the reminders come off whenever it suits the Storyteller.
			const s = marked(scenario(cast)).newDay();
			const ids = s.game.seating.flatMap((id) =>
				s.game.seats[id].reminders
					.filter((r) => r.characterId === 'washerwoman')
					.map((r) => r.reminderId)
			);
			expect(ids).toHaveLength(2);
			const cleared = s.do(
				...ids.map((reminderId) => ({ type: 'RemoveReminder' as const, reminderId }))
			);
			const picker = infoPicker(
				cleared.game,
				cleared.seat('washerwoman'),
				'washerwoman',
				cleared.characters,
				'first'
			)!;
			expect(
				learnedRoles(cleared.game, picker, cleared.characters)?.rows.some((r) => r.marked)
			).toBe(false);
		});
	});
});
