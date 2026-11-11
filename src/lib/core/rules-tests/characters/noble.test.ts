/**
 * Noble: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Noble
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Noble.
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
import { infoPicker, infoRecord, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';

describe('Noble', () => {
	const character = committedCharacter('noble');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Noble');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know', 'Know', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('noble')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Noble#Examples)', () => {
		it('Example 1: Noble gets two good, one evil', () => {
			// Wiki: "The Noble is shown Marianna, Alex, and Abdallah. Marianna and Abdallah are good, and
			// Alex is evil."
			const s = scenario(['noble', 'chef', 'poisoner', 'empath', 'monk', 'imp']);
			const picker = infoPicker(s.game, s.seat('noble'), 'noble', s.characters)!;
			const trio = [s.seat('chef'), s.seat('poisoner'), s.seat('empath')];
			expect(isTruthful(picker, { seats: trio })).toBe(true);
			// Two evil players among the three is not the Noble's information.
			const twoEvil = [s.seat('chef'), s.seat('poisoner'), s.seat('imp')];
			expect(isAllowed(picker, { seats: twoEvil })).toBe(false);
		});
		it('Example 2: Recluse shows up evil to Noble', () => {
			// Wiki: "The Noble learns Doug, Lachlan and Ben. Doug is the Chambermaid. Lachlan is the
			// Barber. Ben is the Recluse, who has registered as evil to the Noble."
			const s = scenario(['noble', 'chambermaid', 'barber', 'recluse', 'poisoner', 'imp']);
			const picker = infoPicker(s.game, s.seat('noble'), 'noble', s.characters)!;
			const trio = { seats: [s.seat('chambermaid'), s.seat('barber'), s.seat('recluse')] };
			expect(isAllowed(picker, trio)).toBe(true);
			expect(isTruthful(picker, trio)).toBe(false);
		});
		it('Example 3: Amy becomes Noble; Spy registers as good', () => {
			// Wiki: "On the third night, the Pit-Hag turns Amy into the Noble. Amy learns that 1 of Evin,
			// Sarah, or Julian is evil. However, Sarah is the evil Spy and has registered as good, and
			// Julian is the Po, who is also evil."
			const s = scenario(['chef', 'empath', 'spy', 'po', 'pithag', 'monk'])
				.newDay()
				.newDay()
				.becomes('chef', 'noble');
			const picker = infoPicker(s.game, s.seat('chef'), 'noble', s.characters)!;
			const trio = { seats: [s.seat('empath'), s.seat('spy'), s.seat('po')] };
			expect(isAllowed(picker, trio)).toBe(true);
			expect(isTruthful(picker, trio)).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Noble#How_to_Run)', () => {
		const cast = ['noble', 'chef', 'poisoner', 'empath', 'monk', 'imp'];
		const know = { characterId: 'noble', label: 'Know' };

		it('lists three Know reminders to place before the first night', () => {
			// Wiki: "While preparing the first night, mark two good players' character tokens with Noble
			// KNOW reminders. Mark any evil player's character token with the third KNOW reminder."
			const s = scenario(cast);
			expect(setupPrep('noble', character.name, s.characters)).toMatchObject([
				{ tokens: ['Know', 'Know', 'Know'] }
			]);
		});

		it('puts Know on two good players and one evil player, no more', () => {
			// Wiki: "While preparing the first night, mark two good players' character tokens with Noble
			// KNOW reminders. Mark any evil player's character token with the third KNOW reminder."
			const s = scenario(cast)
				.reminder('chef', 'noble', 'Know')
				.reminder('empath', 'noble', 'Know');
			expect(reminderTargetMisses(s.game, know, s.seat('monk'), s.characters)).toEqual([
				'alignment'
			]);
			expect(reminderTargetMisses(s.game, know, s.seat('poisoner'), s.characters)).toEqual([]);
			const full = s.reminder('poisoner', 'noble', 'Know');
			expect(reminderTargetMisses(full.game, know, full.seat('imp'), full.characters)).toEqual([
				'alignment'
			]);
		});

		it('points to the three players marked Know on the first night', () => {
			// Wiki: "During the first night, wake the Noble. Point to all three players marked KNOW. Put
			// the Noble to sleep."
			const s = scenario(cast);
			const picker = infoPicker(s.game, s.seat('noble'), 'noble', s.characters)!;
			expect(picker).toMatchObject({ kind: 'players', seatCount: 3 });
			const seats = [s.seat('chef'), s.seat('poisoner'), s.seat('empath')];
			const record = infoRecord(
				picker,
				{ seats },
				{ seat: (id) => id, character: (id) => id },
				s.game,
				s.characters
			);
			expect(record.reminders).toEqual(seats.map((seatId) => ({ seatId, reminder: know })));
		});
	});
});
