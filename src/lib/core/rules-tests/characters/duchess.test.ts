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
import { answerOptions } from '#lib/core/rules/night-info/answers.ts';
import { nightStepInfo } from '#lib/core/rules/night-info/steps.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { stepInfoCards } from '#lib/core/rules/info-token-characters.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';

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
		// Each visitor's true number is how many visitors are evil (M15f); the False Info visitor's
		// number must be false.
		const visits = (cast: string[], visitors: [string, string], liar: string) =>
			scenario(cast)
				.rule('duchess')
				.reminder(visitors[0], 'duchess', 'Visitor')
				.reminder(visitors[1], 'duchess', 'Visitor')
				.reminder(liar, 'duchess', 'False Info');
		const answer = (s: ReturnType<typeof visits>, seat: string) => {
			const info = nightStepInfo(
				s.game,
				{ id: 'duchess' },
				s.characters,
				undefined,
				undefined,
				'other'
			);
			const a =
				info?.kind === 'answer' ? info.answers.find((x) => x.seatId === s.seat(seat)) : undefined;
			return a!;
		};
		const truth = (s: ReturnType<typeof visits>, seat: string) => {
			const a = answer(s, seat);
			return a.kind === 'number' ? a.value : undefined;
		};
		/** The number is an allowed answer for the False Info visitor, and the truth is not. */
		const falseGiven = (s: ReturnType<typeof visits>, seat: string, n: number) => {
			const a = answer(s, seat);
			const options = answerOptions(s.game, a, s.characters);
			const reason = (v: number) =>
				options.find((o) => o.value.kind === 'number' && o.value.value === v)?.reason;
			return (
				a.mustBeFalse === true &&
				![undefined, 'invalid'].includes(reason(n)) &&
				reason(truth(s, seat)!) === 'invalid'
			);
		};

		it('Example 1: Two learn zero, the Sage learns one', () => {
			// Wiki: "The Soldier, Pacifist, and Sage visit the Duchess. The Soldier and Pacifist
			// learn a "0.” The Sage learns a "1.”"
			const s = visits(
				['soldier', 'pacifist', 'sage', 'poisoner', 'imp'],
				['soldier', 'pacifist'],
				'sage'
			);
			expect(truth(s, 'soldier')).toBe(0);
			expect(truth(s, 'pacifist')).toBe(0);
			expect(falseGiven(s, 'sage', 1)).toBe(true);
		});
		it('Example 2: Butler gets two, Mutant and Po one', () => {
			// Wiki: "The Mutant, Butler, and Po visit the Duchess. The Mutant learns a "1,” the
			// Butler learns a "2," and the Po learns a "1.”"
			const s = visits(['mutant', 'butler', 'po', 'poisoner', 'chef'], ['mutant', 'po'], 'butler');
			expect(truth(s, 'mutant')).toBe(1);
			expect(truth(s, 'po')).toBe(1);
			expect(falseGiven(s, 'butler', 2)).toBe(true);
		});
		it('Example 3: Mastermind and Minstrel see two, Imp one', () => {
			// Wiki: "The Mastermind, Imp, and Minstrel visit the Duchess. The Mastermind learns a
			// "2,” the Imp learns a "1," and the Minstrel learns a "2.”"
			const s = visits(
				['mastermind', 'imp', 'minstrel', 'chef', 'empath'],
				['mastermind', 'minstrel'],
				'imp'
			);
			expect(truth(s, 'mastermind')).toBe(2);
			expect(truth(s, 'minstrel')).toBe(2);
			expect(falseGiven(s, 'imp', 1)).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Duchess#How_to_Run)', () => {
		const lines = (s: ReturnType<typeof scenario>) =>
			dayReminders(
				dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
			).groups.flatMap((g) =>
				g.reminders
					.filter((r) => r.characterId === 'duchess')
					.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
			);

		it('says on the day panel that the Duchess is taking visitors', () => {
			// Wiki: "Each day, any player may volunteer to visit the Duchess tonight."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('duchess');
			expect(lines(s)).toEqual([{ group: 'day-ability', text: '[duchess] is taking visitors' }]);
			expect(lines(s.newDay())).toHaveLength(1);
		});

		it('puts False Info on a third visitor, never on a player marked Visitor', () => {
			// Wiki: "If exactly three players volunteer to visit the Duchess tonight, then mark two of
			// them with a VISITOR reminder and one of them with a FALSE INFO reminder."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('duchess')
				.reminder('chef', 'duchess', 'Visitor')
				.reminder('empath', 'duchess', 'Visitor');
			const falseInfo = { characterId: 'duchess', label: 'False Info' };
			expect(reminderTargetMisses(s.game, falseInfo, s.seat('chef'), s.characters)).toEqual([
				'not-with-label'
			]);
			expect(reminderTargetMisses(s.game, falseInfo, s.seat('imp'), s.characters)).toEqual([]);
		});

		it('wakes only the players marked Visitor or False Info, and shows them the Duchess', () => {
			// Wiki: "At night, wake each player marked VISITOR or FALSE INFO one at a time. Show the
			// woken player the Duchess token."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('duchess');
			const woken = (at: ReturnType<typeof scenario>) => {
				const info = nightStepInfo(
					at.game,
					{ id: 'duchess' },
					at.characters,
					undefined,
					undefined,
					'other'
				);
				return info?.kind === 'answer' ? info.answers.map((a) => a.seatId) : [];
			};
			expect(woken(s)).toEqual([]);
			const marked = s
				.reminder('chef', 'duchess', 'Visitor')
				.reminder('monk', 'duchess', 'Visitor')
				.reminder('imp', 'duchess', 'False Info');
			expect(woken(marked)).toEqual([marked.seat('chef'), marked.seat('monk'), marked.seat('imp')]);
			const duchess = s.characters.get('duchess')!;
			expect(stepInfoCards(duchess, duchess.otherNightReminder)).toMatchObject([
				{ token: { id: 'selected-you' }, filled: { characterIds: ['duchess'] } }
			]);
		});

		it('takes the Duchess and its day reminder out of play when it is removed', () => {
			// Wiki: "Remove the Duchess at any time, declaring when you do so."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('duchess')
				.do({ type: 'RemoveRuleCharacter', characterId: 'duchess' });
			expect(s.game.ruleCharacters).not.toContain('duchess');
			expect(lines(s)).toEqual([]);
		});
	});
});
