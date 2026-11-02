/**
 * Engineer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Engineer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Engineer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { alignmentOf, typeOf } from '#lib/core/model/selectors.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/becomes.ts';
import { type Scenario, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Engineer', () => {
	const character = committedCharacter('engineer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Engineer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('engineer')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Engineer#Examples)', () => {
		const typeCount = (at: Scenario, type: string) =>
			at.game.seating.filter((id) => typeOf(at.game, id, at.characters) === type).length;

		it('Example 1: Night-two swap turns Imp into Lleech', () => {
			// Wiki: "On the second night, the Engineer chooses that the Demon is a Lleech. Lewis, who was
			// the Imp, is now the Lleech."
			const s = scenario(['engineer', 'chef', 'imp', 'poisoner', 'monk']).newDay();
			expect(characterChanger(s.game, 'engineer', s.characters)).toBe(s.seat('engineer'));
			expect(changeableSeats(s.game, 'engineer', s.characters)).toEqual([
				s.seat('imp'),
				s.seat('poisoner')
			]);
			const after = s.becomes('imp', 'lleech').reminder('engineer', 'engineer', 'No Ability');
			expect(after.game.seats[after.seat('imp')].characterId).toBe('lleech');
			expect(alignmentOf(after.game, after.seat('imp'))).toBe('evil');
			expect(characterChanger(after.game, 'engineer', after.characters)).toBeUndefined();
		});
		it('Example 2: Baron becomes Boomdandy, extra Outsiders stay', () => {
			// Wiki: "On the first night, the Engineer changes the Baron into the Boomdandy. There are still
			// an extra two Outsiders in play."
			const s = scenario(['engineer', 'baron', 'imp', 'butler', 'saint', 'chef', 'monk']);
			expect(changeableSeats(s.game, 'engineer', s.characters)).toContain(s.seat('baron'));
			expect(changeableSeats(s.game, 'engineer', s.characters)).not.toContain(s.seat('butler'));
			const after = s.becomes('baron', 'boomdandy');
			expect(after.game.seats[after.seat('baron')].characterId).toBe('boomdandy');
			expect(typeCount(after, 'outsider')).toBe(2);
		});
		it('Example 3: Fearmonger and Psychopath become Mezepheles and Spy', () => {
			// Wiki: "The Fearmonger and the Psychopath are in play, and causing havoc. The Engineer chooses
			// that the Mezepheles and the Spy are in play. The Storyteller chooses to change the
			// Fearmonger into the Mezepheles and the Psychopath into the Spy."
			const cast = [
				'engineer',
				'fearmonger',
				'psychopath',
				'imp',
				'chef',
				'monk',
				'empath',
				'soldier'
			];
			const s = scenario(cast);
			expect(changeableSeats(s.game, 'engineer', s.characters)).toEqual([
				s.seat('fearmonger'),
				s.seat('psychopath'),
				s.seat('imp')
			]);
			const after = s.becomes('fearmonger', 'mezepheles').becomes('psychopath', 'spy');
			expect(after.game.seats[after.seat('fearmonger')].characterId).toBe('mezepheles');
			expect(after.game.seats[after.seat('psychopath')].characterId).toBe('spy');
			expect(typeCount(after, 'minion')).toBe(2);
		});
		it('Example 4: Witch alone becomes Mezepheles; others stay', () => {
			// Wiki: "The Spy, Assassin, and Witch are in play. The Engineer chooses that the Spy, Assassin
			// and Mezepheles are in play. The Witch turns into the Mezepheles."
			const cast = [
				'engineer',
				'spy',
				'assassin',
				'witch',
				'imp',
				'chef',
				'monk',
				'empath',
				'soldier',
				'mayor'
			];
			const after = scenario(cast).becomes('witch', 'mezepheles');
			expect(after.game.seats[after.seat('witch')].characterId).toBe('mezepheles');
			expect(after.game.seats[after.seat('spy')].characterId).toBe('spy');
			expect(after.game.seats[after.seat('assassin')].characterId).toBe('assassin');
			expect(alignmentOf(after.game, after.seat('witch'))).toBe('evil');
		});
	});
});
