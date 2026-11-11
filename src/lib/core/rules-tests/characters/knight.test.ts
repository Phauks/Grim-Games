/**
 * Knight: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Knight
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Knight.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	infoPicker,
	infoRecord,
	isAllowed,
	isTruthful
} from '#lib/core/rules/night/info/picker.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';

describe('Knight', () => {
	const character = committedCharacter('knight');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Knight');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('knight')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Knight#Examples)', () => {
		it('Example 1: Knight learns Undertaker and Fortune Teller players', () => {
			// Wiki: "Lewis is the Undertaker, Doug is the Imp and Ben is the Fortune Teller. The Knight
			// learns Lewis and Ben."
			// Two players who are not the Demon; a pair with the Demon is not allowed.
			const s = scenario(['knight', 'undertaker', 'imp', 'fortuneteller', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('knight'), 'knight', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('undertaker'), s.seat('fortuneteller')] })).toBe(
				true
			);
			expect(isAllowed(picker, { seats: [s.seat('undertaker'), s.seat('imp')] })).toBe(false);
		});

		it("Example 2: Vortox forces the Knight's info to include the Demon", () => {
			// Wiki: "Marianna is the Vortox and Abdallah is the Alchemist. The Knight learns Marianna and
			// Abdallah. The Knight must learn Marianna and Abdallah because the Knight's information must
			// be false due to the Vortox ability and therefore include the Demon."
			const s = scenario(['knight', 'alchemist', 'vortox', 'chef', 'witch']);
			const picker = infoPicker(s.game, s.seat('knight'), 'knight', s.characters)!;
			expect(isAllowed(picker, { seats: [s.seat('vortox'), s.seat('alchemist')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('alchemist'), s.seat('chef')] })).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Knight#How_to_Run)', () => {
		const cast = ['knight', 'undertaker', 'imp', 'fortuneteller', 'poisoner'];
		const know = { characterId: 'knight', label: 'Know' };

		it('lists two Know reminders to place during setup', () => {
			// Wiki: "During setup, mark two non-Demon players with the Knight’s KNOW reminders."
			const s = scenario(cast);
			expect(setupPrep('knight', character.name, s.characters)).toMatchObject([
				{ tokens: ['Know', 'Know'] }
			]);
		});

		it('puts Know only on players who are not the Demon', () => {
			// Wiki: "During setup, mark two non-Demon players with the Knight’s KNOW reminders."
			const s = scenario(cast);
			expect(reminderTargetMisses(s.game, know, s.seat('undertaker'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, know, s.seat('poisoner'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, know, s.seat('imp'), s.characters)).toEqual(['type']);
		});

		it('points to the two players marked Know on the first night', () => {
			// Wiki: "During the first night, wake the Knight. Point to the two players marked KNOW."
			const s = scenario(cast);
			const picker = infoPicker(s.game, s.seat('knight'), 'knight', s.characters)!;
			expect(picker).toMatchObject({ kind: 'players', seatCount: 2 });
			const choice = { seats: [s.seat('undertaker'), s.seat('fortuneteller')] };
			const record = infoRecord(
				picker,
				choice,
				{ seat: (id) => id, character: (id) => id },
				s.game,
				s.characters
			);
			expect(record.reminders).toEqual([
				{ seatId: s.seat('undertaker'), reminder: know },
				{ seatId: s.seat('fortuneteller'), reminder: know }
			]);
		});
	});
});
