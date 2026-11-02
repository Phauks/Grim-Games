/**
 * Artist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Artist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Artist.
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
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Artist', () => {
	const character = committedCharacter('artist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Artist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('artist')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Artist#Examples)', () => {
		// The Storyteller answers the question; the app tracks that the once-per-game ability is used.
		const asked = (s: Scenario) =>
			s.do((at) => ({ type: 'UseAbility', seatId: at.seat('artist'), characterId: 'artist' }));
		const spent = (s: Scenario) =>
			s.game.seats[s.seat('artist')].reminders.some(
				(r) => r.characterId === 'artist' && r.label === 'No Ability'
			);
		const mayAsk = (s: Scenario) =>
			dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
				.groups.flatMap((g) => g.reminders)
				.some((r) => r.characterId === 'artist');

		it('Example 1: Asks whether the Demon sits in a certain seat', () => {
			// Wiki: "The Artist asks, "Is the Demon sitting in a brown chair?" The Storyteller answers, "No,”
			// because the Demon is in a black chair."
			const s = scenario(['artist', 'imp', 'chef', 'empath', 'poisoner']).newDay();
			expect(mayAsk(s)).toBe(true);
			const after = asked(s);
			expect(spent(after)).toBe(true);
			expect(mayAsk(after)).toBe(false);
		});

		it('Example 2: Asks whether a player is the Evil Twin', () => {
			// Wiki: "The Artist asks, "Is David the Evil Twin?” and the Storyteller answers, "Yes,” because
			// David is."
			const s = scenario(['artist', 'eviltwin', 'imp', 'chef', 'empath']).newDay();
			expect(trueCharacter(s.game, s.seat('eviltwin'), s.characters)).toBe('eviltwin');
			expect(spent(asked(s))).toBe(true);
		});

		it('Example 3: Minion count question is refused', () => {
			// Wiki: "The Artist asks, "How many Minions are alive?” and the Storyteller says, "Please ask
			// another question. I cannot answer that with a yes, no, or I don't know.""
			// A refused question is not a use: nothing is logged, and the Artist may still ask.
			const s = scenario(['artist', 'imp', 'chef', 'empath', 'poisoner']).newDay();
			expect(spent(s)).toBe(false);
			expect(mayAsk(s)).toBe(true);
		});

		it('Example 4: Winning question answered as uncertain', () => {
			// Wiki: "The Artist asks, "Are we winning?” and the Storyteller answers, "I don't know,” because
			// even though all the Minions are dead, many good players trust the Demon."
			const s = scenario(['artist', 'imp', 'chef', 'empath', 'poisoner']).dies('poisoner').newDay();
			const after = asked(s);
			expect(spent(after)).toBe(true);
			expect(mayAsk(after)).toBe(false);
		});
	});
});
