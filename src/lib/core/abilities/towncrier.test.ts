/**
 * Town Crier: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Town_Crier
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Town Crier.
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
import { suggestedMark } from '#lib/core/rules/day-marks.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { todaysNominations } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Town Crier', () => {
	const character = committedCharacter('towncrier');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Town Crier');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Minions Not Nominated', 'Minion Nominated']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('towncrier')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Town_Crier#Examples)', () => {
		it('Example 1: Minions nominated, so the Town Crier hears yes', () => {
			// Wiki: "Today, four players nominated. Two of them were Minions. Many players voted, but there
			// was no execution. That night, the Town Crier learns a “yes.”"
			const s = scenario(['towncrier', 'witch', 'cerenovus', 'chef', 'empath', 'vortox'])
				.nominate('witch', 'chef')
				.nominate('chef', 'witch')
				.nominate('cerenovus', 'empath')
				.nominate('empath', 'vortox');
			expect(suggestedMark(s.game, 'minion-nominated', s.characters)).toBe(true);
			expect(nightAnswer(s.game, s.seat('towncrier'), 'towncrier', s.characters)).toMatchObject({
				kind: 'yes-no',
				value: true,
				because: [s.seat('witch'), s.seat('cerenovus')]
			});
		});

		it('Example 2: Exiled Traveller means the Town Crier hears no', () => {
			// Wiki: "A Minion called for the exile of a Traveller, who was exiled. That night, the Town Crier
			// learns a “no.” (Exiles are never affected by character abilities.)"
			const s = scenario(['towncrier', 'witch', 'chef', 'empath', 'vortox', 'thief'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'good' }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('thief') }));
			// The exile is not a nomination, so nothing says yes.
			expect(todaysNominations(s.game)).toEqual([]);
			expect(suggestedMark(s.game, 'minion-nominated', s.characters)).toBeUndefined();
			expect(nightAnswer(s.game, s.seat('towncrier'), 'towncrier', s.characters)).not.toMatchObject(
				{
					value: true
				}
			);
			const marked = s.do({ type: 'SetDayMark', mark: 'minion-nominated', value: false });
			expect(
				nightAnswer(marked.game, marked.seat('towncrier'), 'towncrier', marked.characters)
			).toMatchObject({ kind: 'yes-no', value: false });
		});
	});
});
