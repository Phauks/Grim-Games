/**
 * Revolutionary: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Revolutionary
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Revolutionary.
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
import { registrations } from '#lib/core/rules/abilities/registration.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupReminders } from '#lib/core/rules/setup/setup-reminders.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Revolutionary', () => {
	const character = committedCharacter('revolutionary');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Revolutionary');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Register Falsely?', 'Aligned', 'Aligned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('revolutionary')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Revolutionary#Examples)', () => {
		const pair = (cast: string[], a: string, b: string) =>
			scenario(cast)
				.rule('revolutionary')
				.reminder(a, 'revolutionary', 'Aligned')
				.reminder(b, 'revolutionary', 'Aligned')
				.reminder(a, 'revolutionary', 'Register Falsely?');

		it('Example 1: Deaf player paired with Poisoner-Imp duo', () => {
			// Wiki: "Mathew is deaf. He teams up with Davo, via the Revolutionary. Mathew draws the
			// Poisoner, and Davo draws the Imp. They can scheme in private, using sign language, so
			// that Mathew can still participate."
			// The two neighbours share an alignment; one of them may register falsely once.
			const s = pair(['poisoner', 'imp', 'chef', 'empath', 'monk'], 'poisoner', 'imp');
			const regs = registrations(s.game, s.characters);
			expect(regs.map((r) => r.seatId)).toEqual([s.seat('poisoner'), s.seat('imp')]);
			expect(regs[0]).toMatchObject({
				alignments: ['evil', 'good'],
				source: { characterId: 'revolutionary' }
			});
		});
		it('Example 2: Young player paired with parent, Fortune Teller', () => {
			// Wiki: "Hannah is 12 years old. She is keen to play, but does not understand many of
			// the intricacies of how the characters work. She gets the Ravenkeeper and teams up
			// with her father, who is the Fortune Teller."
			const s = pair(
				['ravenkeeper', 'fortuneteller', 'chef', 'poisoner', 'imp'],
				'ravenkeeper',
				'fortuneteller'
			);
			const regs = registrations(s.game, s.characters);
			expect(regs.map((r) => r.seatId)).toEqual([s.seat('ravenkeeper'), s.seat('fortuneteller')]);
			expect(regs[1].alignments).toEqual(['good', 'evil']);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Revolutionary#How_to_Run)', () => {
		it('asks at setup for Register Falsely? between two neighbours', () => {
			// Wiki: "When setting up the game, before giving the bag to the players, declare that the
			// Revolutionary is in play and which two neighboring players are Revolutionaries. Add the
			// Revolutionary token to the Grimoire. Mark the Revolutionaries with the REGISTER FALSELY?
			// reminder between their character tokens."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('revolutionary');
			const prep = setupReminders(s.game, s.characters).filter(
				(r) => r.characterId === 'revolutionary'
			);
			expect(prep).toMatchObject([
				{ label: 'Register Falsely?', choice: 'between 2 neighbours of the same alignment' }
			]);
		});

		it('pairs only neighbours as the two Revolutionaries', () => {
			// Wiki: "which two neighboring players are Revolutionaries."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('revolutionary')
				.reminder('chef', 'revolutionary', 'Aligned');
			const aligned = { characterId: 'revolutionary', label: 'Aligned' };
			expect(reminderTargetMisses(s.game, aligned, s.seat('empath'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, aligned, s.seat('monk'), s.characters)).toEqual([
				'neighbour'
			]);
		});

		it('flags a second Revolutionary of the other alignment', () => {
			// Wiki: "Look at their token, choose a token of the same alignment from the bag, and give
			// it to the other Revolutionary."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('revolutionary')
				.reminder('chef', 'revolutionary', 'Aligned');
			const aligned = { characterId: 'revolutionary', label: 'Aligned' };
			expect(reminderTargetMisses(s.game, aligned, s.seat('imp'), s.characters)).toContain(
				'alignment'
			);
		});

		it('lets neither Revolutionary register falsely once Register Falsely? is removed', () => {
			// Wiki: "Once per game, you can make one player marked REGISTER FALSELY? register as a
			// different character and alignment, then remove the REGISTER FALSELY? reminder."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('revolutionary')
				.reminder('chef', 'revolutionary', 'Aligned')
				.reminder('empath', 'revolutionary', 'Aligned')
				.reminder('chef', 'revolutionary', 'Register Falsely?');
			expect(registrations(s.game, s.characters)).toHaveLength(2);
			const used = s.do((at) => ({
				type: 'RemoveReminder',
				reminderId: at.game.seats[at.seat('chef')].reminders.find(
					(r) => r.label === 'Register Falsely?'
				)!.reminderId
			}));
			expect(registrations(used.game, used.characters)).toEqual([]);
		});
	});
});
