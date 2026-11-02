/**
 * Fortune Teller: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fortune_Teller
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fortune Teller.
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
import { infoPicker, isTruthful } from '#lib/core/rules/night-info.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fortune Teller', () => {
	const character = committedCharacter('fortuneteller');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Fortune Teller');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Red Herring']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('fortuneteller')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fortune_Teller#Examples)', () => {
		it('Example 1: Monk and Undertaker, learns no', () => {
			// Wiki: "The Fortune Teller chooses the Monk and the Undertaker and learns a 'no'."
			const s = scenario(['fortuneteller', 'monk', 'undertaker', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(
				isTruthful(picker, { seats: [s.seat('monk'), s.seat('undertaker')], yes: false })
			).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('monk'), s.seat('undertaker')], yes: true })).toBe(
				false
			);
		});

		it('Example 2: Imp and Empath, learns yes', () => {
			// Wiki: "The Fortune Teller chooses the Imp and the Empath, and learns a 'yes'."
			const s = scenario(['fortuneteller', 'imp', 'empath', 'monk', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp'), s.seat('empath')], yes: true })).toBe(
				true
			);
		});

		it('Example 3: alive Butler and dead Imp, learns yes', () => {
			// Wiki: "The Fortune Teller chooses an alive Butler and a dead Imp, and learns a 'yes'."
			// A dead Demon still counts.
			const s = scenario(['fortuneteller', 'butler', 'imp', 'monk', 'poisoner']).dies('imp');
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('butler'), s.seat('imp')], yes: true })).toBe(
				true
			);
		});

		it('Example 4: themselves and the Saint who is the Red Herring, learns yes', () => {
			// Wiki: "The Fortune Teller chooses themselves and a Saint. The Saint is the Red Herring. The
			// Fortune Teller learns a 'yes'."
			const s = scenario(['fortuneteller', 'saint', 'imp', 'monk', 'poisoner']).reminder(
				'saint',
				'fortuneteller',
				'Red Herring'
			);
			const picker = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			const chose = [s.seat('fortuneteller'), s.seat('saint')];
			expect(isTruthful(picker, { seats: chose, yes: true })).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Fortune_Teller#How_to_Run)', () => {
		const cast = ['fortuneteller', 'monk', 'chef', 'imp', 'poisoner'];

		it('lists the Red Herring reminder to place before the first night', () => {
			// How to Run: before night one, the Storyteller marks one good player as the Red Herring.
			const s = scenario(cast);
			expect(setupPrep('fortuneteller', character.name, s.characters)).toMatchObject([
				{ tokens: ['Red Herring'] }
			]);
		});

		it('puts the Red Herring only on a good player', () => {
			// How to Run: the Red Herring reminder goes beside a good character token.
			const s = scenario(cast);
			const reminder = { characterId: 'fortuneteller', label: 'Red Herring' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('monk'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, reminder, s.seat('poisoner'), s.characters)).toEqual([
				'alignment'
			]);
		});

		it('chooses two players and learns yes or no, on the first night and every other night', () => {
			// How to Run: every night, the Fortune Teller points at two players and the Storyteller
			// nods or shakes their head.
			const s = scenario(cast);
			for (const night of ['first', 'other'] as const) {
				const picker = infoPicker(
					s.game,
					s.seat('fortuneteller'),
					'fortuneteller',
					s.characters,
					night
				)!;
				expect(picker.kind).toBe('yes-no');
				expect(picker.seatCount).toBe(2);
			}
		});

		it('may be their own Red Herring, so choosing themselves gives yes', () => {
			// How to Run: in small games the Fortune Teller can be their own Red Herring.
			const s = scenario(cast);
			const reminder = { characterId: 'fortuneteller', label: 'Red Herring' };
			expect(reminderTargetMisses(s.game, reminder, s.seat('fortuneteller'), s.characters)).toEqual(
				[]
			);
			const own = s.reminder('fortuneteller', 'fortuneteller', 'Red Herring');
			const picker = infoPicker(
				own.game,
				own.seat('fortuneteller'),
				'fortuneteller',
				own.characters
			)!;
			const chose = [own.seat('fortuneteller'), own.seat('monk')];
			expect(isTruthful(picker, { seats: chose, yes: true })).toBe(true);
			expect(isTruthful(picker, { seats: chose, yes: false })).toBe(false);
		});
	});
});
