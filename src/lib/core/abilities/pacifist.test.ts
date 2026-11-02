/**
 * Pacifist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pacifist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pacifist.
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
import { executionSavers, protection } from '#lib/core/rules/ability.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Pacifist', () => {
	const character = committedCharacter('pacifist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Pacifist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('pacifist')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pacifist#Examples)', () => {
		const savedByPacifist = (s: Scenario, ref: string) =>
			s.do((at) => ({ type: 'Execute', seatId: at.seat(ref), savedBy: 'pacifist' }));
		const pacifistFor = (s: Scenario, ref: string) =>
			executionSavers(s.game, s.seat(ref), s.characters).find(
				(x) => x.source.characterId === 'pacifist'
			);
		const dead = (s: Scenario, ref: string) => s.game.seats[s.seat(ref)].dead;

		it('Example 1: Executed Innkeeper survives thanks to Pacifist', () => {
			// Wiki: "The Innkeeper is executed, but remains alive because of the Pacifist."
			const s = scenario(['innkeeper', 'pacifist', 'imp', 'chef', 'poisoner']);
			expect(pacifistFor(s, 'innkeeper')).toEqual({
				source: { characterId: 'pacifist', seatId: s.seat('pacifist') }
			});
			expect(dead(savedByPacifist(s, 'innkeeper'), 'innkeeper')).toBe(false);
		});

		it('Example 2: Pacifist saves nobody despite many executions', () => {
			// Wiki: "The Pacifist is in play. Good is winning. Even after 7 days, and 5 good players
			// executed, the Pacifist ability has not saved anybody."
			// The Pacifist's players only "might not die": the Storyteller picks it, it is never automatic.
			const good = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath'];
			let s = scenario([...good, 'pacifist', 'imp', 'poisoner']);
			for (const id of good) {
				expect(pacifistFor(s, id)?.problem).toBeUndefined();
				expect(protection(s.game, s.seat(id), s.characters, 'execution')).toBeUndefined();
				s = s.execute(id);
				expect(dead(s, id)).toBe(true);
				s = s.newDay();
			}
		});

		it('Example 3: Drunk Pacifist fails; exile still kills', () => {
			// Wiki: "The Pacifist is in play. Evil is winning. The Lunatic is executed, but remains alive.
			// The next day, the Professor is executed and dies, because the Pacifist is drunk. The next
			// day, a good Bishop is exiled and dies, because the Pacifist saves people from execution, not
			// exile. The next day, the Pacifist is executed but remains alive because of the Pacifist."
			let s = scenario([
				'pacifist',
				'lunatic',
				'professor',
				'bishop',
				'sailor',
				'imp',
				'poisoner',
				'chef'
			]).do((at) => ({ type: 'SetAlignment', seatId: at.seat('bishop'), alignment: 'good' }));
			s = savedByPacifist(s, 'lunatic');
			expect(dead(s, 'lunatic')).toBe(false);

			s = s.newDay().reminder('pacifist', 'sailor', 'Drunk');
			expect(pacifistFor(s, 'professor')?.problem).toBe('impaired');
			s = s.execute('professor');
			expect(dead(s, 'professor')).toBe(true);

			const drunkToken = s.game.seats[s.seat('pacifist')].reminders.find(
				(r) => r.characterId === 'sailor'
			)!;
			s = s
				.newDay()
				.do({ type: 'RemoveReminder', reminderId: drunkToken.reminderId })
				.do((at) => ({ type: 'Exile', seatId: at.seat('bishop') }));
			expect(dead(s, 'bishop')).toBe(true);

			s = s.newDay();
			expect(pacifistFor(s, 'pacifist')?.problem).toBeUndefined();
			expect(dead(savedByPacifist(s, 'pacifist'), 'pacifist')).toBe(false);
		});
	});
});
