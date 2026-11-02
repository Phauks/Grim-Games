/**
 * Bone Collector: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bone_Collector
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bone Collector.
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
import { abilityState } from '#lib/core/rules/ability.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { nominatorsAfterExecution } from '#lib/core/rules/nominations.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Bone Collector', () => {
	const character = committedCharacter('bonecollector');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Bone Collector');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability', 'Has Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('bonecollector')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bone_Collector#Examples)', () => {
		const works = (s: Scenario, ref: string) =>
			abilityState(s.game, s.seat(ref), s.characters).works;

		it('Example 1: Flowergirl regains ability, learns if Demon voted', () => {
			// Wiki: "The Bone Collector gives the dead Flowergirl her ability back. That night, the
			// Flowergirl learns that the Demon did indeed vote today. The following night, the Flowergirl
			// once again has no ability."
			const dead = scenario(['bonecollector', 'flowergirl', 'imp', 'chef', 'poisoner'])
				.dies('flowergirl')
				.newDay();
			expect(works(dead, 'flowergirl')).toBe(false);
			const tonight = dead
				.do({ type: 'SetDayMark', mark: 'demon-voted', value: true })
				.reminder('flowergirl', 'bonecollector', 'Has Ability');
			expect(works(tonight, 'flowergirl')).toBe(true);
			expect(
				nightAnswer(tonight.game, tonight.seat('flowergirl'), 'flowergirl', tonight.characters)
			).toMatchObject({ kind: 'yes-no', value: true });
			const token = tonight.game.seats[tonight.seat('flowergirl')].reminders.find(
				(r) => r.label === 'Has Ability'
			)!;
			const following = tonight
				.newDay()
				.do({ type: 'RemoveReminder', reminderId: token.reminderId });
			expect(works(following, 'flowergirl')).toBe(false);
		});

		it("Example 2: Witch's curse makes Clockmaker nominate and die", () => {
			// Wiki: "The Bone Collector chooses the dead Witch. The Witch wakes and curses the Clockmaker.
			// The Clockmaker nominates the following day, and dies."
			const s = scenario(['bonecollector', 'witch', 'clockmaker', 'imp', 'chef', 'empath'])
				.dies('witch')
				.reminder('witch', 'bonecollector', 'Has Ability')
				.reminder('clockmaker', 'witch', 'Cursed');
			expect(works(s, 'witch')).toBe(true);
			const day = s.newDay().nominate('clockmaker', 'imp');
			expect(validDeathCauses(day.game, day.seat('clockmaker'), day.characters)).toContainEqual(
				expect.objectContaining({ cause: 'witch', flags: [] })
			);
		});

		it('Example 3: Butcher gets another nomination after an execution', () => {
			// Wiki: "At night, the Bone Collector chooses the dead Butcher. The following day, after an
			// execution has occurred, the Storyteller prompts the Butcher to nominate again."
			const s = scenario(['bonecollector', 'butcher', 'imp', 'chef', 'empath', 'poisoner'])
				.dies('butcher')
				.reminder('butcher', 'bonecollector', 'Has Ability')
				.newDay()
				.nominate('chef', 'empath')
				.execute('empath');
			expect(nominatorsAfterExecution(s.game, undefined, s.characters)).toContain(
				s.seat('butcher')
			);
		});

		it('Example 4: Juggler learns how many guesses were correct', () => {
			// Wiki: "During the day, the dead Juggler guesses five players’ characters. That night, the Bone
			// Collector gives the Juggler their ability back. The Juggler learns a "3"."
			const s = scenario(['bonecollector', 'juggler', 'imp', 'chef', 'empath', 'poisoner'])
				.dies('juggler')
				.newDay()
				.do((at) => ({
					type: 'DayNote',
					characterId: 'juggler',
					seatId: at.seat('juggler'),
					text: 'Juggled',
					guesses: [
						{ seatId: at.seat('imp'), characterId: 'imp' },
						{ seatId: at.seat('chef'), characterId: 'chef' },
						{ seatId: at.seat('empath'), characterId: 'empath' },
						{ seatId: at.seat('poisoner'), characterId: 'spy' },
						{ seatId: at.seat('bonecollector'), characterId: 'monk' }
					]
				}))
				.reminder('juggler', 'bonecollector', 'Has Ability');
			expect(works(s, 'juggler')).toBe(true);
			expect(nightAnswer(s.game, s.seat('juggler'), 'juggler', s.characters)).toMatchObject({
				kind: 'number',
				value: 3
			});
		});
	});
});
