/**
 * Mathematician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mathematician
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mathematician.
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
	answerCauses,
	answerOptions,
	nightAnswer,
	reliability
} from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Mathematician', () => {
	const character = committedCharacter('mathematician');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Mathematician');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([
				'Abnormal',
				'Abnormal',
				'Abnormal',
				'Abnormal',
				'Abnormal'
			]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('mathematician')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mathematician#Examples)', () => {
		it('Example 1: Poisoned Oracle miscounts evil players, one error', () => {
			// Wiki: "The poisoned Oracle learns that two dead players are evil, when three dead players are
			// actually evil. All other character abilities work normally. Later that night, the
			// Mathematician learns a "1"."
			const s = scenario([
				'mathematician',
				'oracle',
				'nodashii',
				'witch',
				'cerenovus',
				'pithag',
				'chef',
				'empath',
				'sage'
			])
				.reminder('oracle', 'nodashii', 'Poisoned')
				.dies('witch')
				.dies('cerenovus')
				.dies('pithag')
				.newDay();
			const oracle = nightAnswer(s.game, s.seat('oracle'), 'oracle', s.characters)!;
			expect(oracle).toMatchObject({ kind: 'number', value: 3, unreliable: 'poisoned' });
			const after = s.do((at) => ({
				type: 'RecordNightInfo',
				seatId: at.seat('oracle'),
				characterId: 'oracle',
				text: 'Shown 2',
				abnormal: answerCauses(oracle)
			}));
			expect(
				nightAnswer(after.game, after.seat('mathematician'), 'mathematician', after.characters)
			).toMatchObject({ kind: 'number', value: 1, because: [after.seat('oracle')] });
		});

		it("Example 2: Savant's single false fact causes one malfunction", () => {
			// Wiki: "The poisoned Snake Charmer chooses a Townsfolk player, and nothing happens. The drunk
			// Juggler gets correct information. The Savant learns two pieces of true information. Later
			// that night, the Mathematician learns a "1" because the Snake Charmer and Juggler's
			// abilities worked as normal, whilst one of the Savant's facts was true when it should have
			// been false."
			// The No Dashii poisons the Snake Charmer and the Savant; the Philosopher took the Juggler's
			// ability, so the Juggler is drunk.
			const s = scenario([
				'mathematician',
				'snakecharmer',
				'nodashii',
				'savant',
				'juggler',
				'philosopher',
				'witch',
				'chef'
			])
				.reminder('snakecharmer', 'nodashii', 'Poisoned')
				.reminder('savant', 'nodashii', 'Poisoned')
				.reminder('juggler', 'philosopher', 'Drunk')
				.newDay();
			const savant = reliability(s.game, s.seat('savant'), 'savant', s.characters);
			expect(savant.unreliable).toBe('poisoned');
			const after = s.do(
				(at) => ({
					type: 'RecordNightInfo',
					seatId: at.seat('snakecharmer'),
					characterId: 'snakecharmer',
					text: 'Chose a Townsfolk: nothing happened'
				}),
				(at) => ({
					type: 'RecordNightInfo',
					seatId: at.seat('juggler'),
					characterId: 'juggler',
					text: 'Shown the true count'
				}),
				(at) => ({
					type: 'RecordNightInfo',
					seatId: at.seat('savant'),
					characterId: 'savant',
					text: 'Two true facts',
					abnormal: answerCauses(savant)
				})
			);
			expect(
				nightAnswer(after.game, after.seat('mathematician'), 'mathematician', after.characters)
			).toMatchObject({ kind: 'number', value: 1, because: [after.seat('savant')] });
		});

		it('Example 3: Vortox makes the count undercount real malfunctions', () => {
			// Wiki: "A Vortox is in play. Five good players got false information. The Witch is drunk, and
			// when their cursed player nominated, nothing happened. Even though six abilities worked
			// abnormally, the Mathematician learns a "4" due to the Vortox's ability."
			// The Storyteller marks the six players whose ability worked abnormally.
			const falseInfo = ['clockmaker', 'dreamer', 'oracle', 'flowergirl', 'seamstress'] as const;
			const s = [...falseInfo, 'witch' as const].reduce(
				(at, seat) => at.reminder(seat, 'mathematician', 'Abnormal'),
				scenario(['mathematician', ...falseInfo, 'sweetheart', 'witch', 'vortox'])
					.dies('sweetheart')
					.reminder('witch', 'sweetheart', 'Drunk')
			);
			const count = nightAnswer(s.game, s.seat('mathematician'), 'mathematician', s.characters)!;
			expect(count).toMatchObject({
				kind: 'number',
				value: 6,
				mustBeFalse: true,
				falseBy: 'vortox'
			});
			const options = answerOptions(s.game, count, s.characters);
			expect(options).toContainEqual({ reason: 'invalid', value: { kind: 'number', value: 6 } });
			expect(options).toContainEqual({ reason: 'vortox', value: { kind: 'number', value: 4 } });
		});
	});
});
