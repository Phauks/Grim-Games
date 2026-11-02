/**
 * Duchess: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Duchess
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Duchess.
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
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Duchess', () => {
	const character = committedCharacter('duchess');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Duchess');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Visitor', 'Visitor', 'False Info']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('duchess')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Duchess#Examples)', () => {
		// Waits on the engine (all three): the Duchess has no night information rule, so there is
		// no picker giving each visitor how many visitors are evil, nor one false answer.
		const visits = (cast: string[], visitors: [string, string], liar: string) =>
			scenario(cast)
				.rule('duchess')
				.reminder(visitors[0], 'duchess', 'Visitor')
				.reminder(visitors[1], 'duchess', 'Visitor')
				.reminder(liar, 'duchess', 'False Info');

		it.fails('Example 1: Two learn zero, the Sage learns one', () => {
			// Wiki: "The Soldier, Pacifist, and Sage visit the Duchess. The Soldier and Pacifist
			// learn a "0.” The Sage learns a "1.”"
			const s = visits(
				['soldier', 'pacifist', 'sage', 'poisoner', 'imp'],
				['soldier', 'pacifist'],
				'sage'
			);
			const picker = (seat: string) => infoPicker(s.game, s.seat(seat), 'duchess', s.characters);
			expect(picker('soldier')?.range?.truth).toBe(0);
			expect(picker('pacifist')?.range?.truth).toBe(0);
			expect(isTruthful(picker('sage')!, { seats: [], number: 1 })).toBe(false);
		});
		it.fails('Example 2: Butler gets two, Mutant and Po one', () => {
			// Wiki: "The Mutant, Butler, and Po visit the Duchess. The Mutant learns a "1,” the
			// Butler learns a "2," and the Po learns a "1.”"
			const s = visits(['mutant', 'butler', 'po', 'poisoner', 'chef'], ['mutant', 'po'], 'butler');
			const picker = (seat: string) => infoPicker(s.game, s.seat(seat), 'duchess', s.characters);
			expect(picker('mutant')?.range?.truth).toBe(1);
			expect(picker('po')?.range?.truth).toBe(1);
			expect(isTruthful(picker('butler')!, { seats: [], number: 2 })).toBe(false);
		});
		it.fails('Example 3: Mastermind and Minstrel see two, Imp one', () => {
			// Wiki: "The Mastermind, Imp, and Minstrel visit the Duchess. The Mastermind learns a
			// "2,” the Imp learns a "1," and the Minstrel learns a "2.”"
			const s = visits(
				['mastermind', 'imp', 'minstrel', 'chef', 'empath'],
				['mastermind', 'minstrel'],
				'imp'
			);
			const picker = (seat: string) => infoPicker(s.game, s.seat(seat), 'duchess', s.characters);
			expect(picker('mastermind')?.range?.truth).toBe(2);
			expect(picker('minstrel')?.range?.truth).toBe(2);
			expect(isTruthful(picker('imp')!, { seats: [], number: 1 })).toBe(false);
		});
	});
});
