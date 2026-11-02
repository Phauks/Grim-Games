/**
 * Librarian: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Librarian
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Librarian.
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

describe('Librarian', () => {
	const character = committedCharacter('librarian');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Librarian');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Outsider', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('librarian')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Librarian#Examples)', () => {
		it('Example 1: Saint is one of two players', () => {
			// Wiki: "Benjamin is the Saint, and Filip is the Baron. The Librarian learns that either
			// Benjamin or Filip is the Saint."
			const s = scenario(['librarian', 'saint', 'baron', 'imp', 'chef', 'butler', 'monk']);
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			const shown = { seats: [s.seat('saint'), s.seat('baron')], characterId: 'saint' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: no Outsiders, so learns zero', () => {
			// Wiki: "There are no Outsiders in this game. The Librarian learns a '0'."
			const s = scenario(['librarian', 'chef', 'empath', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			expect(isTruthful(picker, { seats: [], none: true })).toBe(true);
		});

		it('Example 3: Drunk who thinks they are the Monk is shown as the Drunk', () => {
			// Wiki: "Abdallah is the Drunk, who thinks they are the Monk, and Douglas is the Undertaker.
			// The Librarian learns that either Abdallah or Douglas is the Drunk. (This happens because the
			// Librarian learns the true character. The Drunk is Abdallah’s true character, not the Monk.)"
			const s = scenario(['librarian', 'monk', 'undertaker', 'imp', 'poisoner']).drunk('monk');
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters)!;
			const shown = { seats: [s.seat('monk'), s.seat('undertaker')], characterId: 'drunk' };
			expect(isTruthful(picker, shown)).toBe(true);
			expect(isAllowed(picker, { seats: [], none: true })).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Librarian#How_to_Run)', () => {
		const cast = ['librarian', 'saint', 'chef', 'imp', 'poisoner'];
		const marked = (s: Scenario) =>
			s.reminder('saint', 'librarian', 'Outsider').reminder('imp', 'librarian', 'Wrong');

		it('lists the Outsider and Wrong reminders to place before the first night', () => {
			// How to Run: before night one, the Storyteller marks one Outsider with Outsider and a
			// second player with Wrong.
			const s = scenario(cast);
			expect(setupPrep('librarian', character.name, s.characters).map((p) => p.tokens)).toEqual([
				['Outsider'],
				['Wrong']
			]);
		});

		it('puts the Outsider reminder only on a Outsider', () => {
			// How to Run: the Outsider reminder goes beside a Outsider's character token.
			const s = scenario(cast);
			const reminder = { characterId: 'librarian', label: 'Outsider' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('saint'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('chef'), s.characters)).toEqual([
				'type'
			]);
		});

		it('puts the Wrong reminder on any other seat, never the one marked Outsider', () => {
			// How to Run: the Wrong reminder goes beside a different character token.
			const s = scenario(cast).reminder('saint', 'librarian', 'Outsider');
			const reminder = { characterId: 'librarian', label: 'Wrong' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('imp'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('saint'), s.characters)).toEqual([
				'not-with-label'
			]);
		});

		it('on the first night, shows the two marked players and the marked character', () => {
			// How to Run: on night one, point at the seats marked Outsider and Wrong, and show the
			// character marked Outsider.
			const s = marked(scenario(cast));
			const picker = infoPicker(s.game, s.seat('librarian'), 'librarian', s.characters, 'first')!;
			expect(picker.seatCount).toBe(2);
			expect(learnedRoles(s.game, picker, s.characters)?.rows[0]).toMatchObject({
				target: s.seat('saint'),
				other: s.seat('imp'),
				characterIds: ['saint'],
				marked: true
			});
		});

		it('lets the Storyteller remove both reminders once they are shown', () => {
			// How to Run: the reminders come off whenever it suits the Storyteller.
			const s = marked(scenario(cast)).newDay();
			const ids = s.game.seating.flatMap((id) =>
				s.game.seats[id].reminders
					.filter((r) => r.characterId === 'librarian')
					.map((r) => r.reminderId)
			);
			expect(ids).toHaveLength(2);
			const cleared = s.do(
				...ids.map((reminderId) => ({ type: 'RemoveReminder' as const, reminderId }))
			);
			const picker = infoPicker(
				cleared.game,
				cleared.seat('librarian'),
				'librarian',
				cleared.characters,
				'first'
			)!;
			expect(
				learnedRoles(cleared.game, picker, cleared.characters)?.rows.some((r) => r.marked)
			).toBe(false);
		});
	});
});
