/**
 * Zealot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Zealot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Zealot.
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
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The Zealot's day reminders, as plain text. */
const zealotLines = (s: Scenario) =>
	dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders.filter((r) => r.characterId === 'zealot').map((r) => renderReminder(r.segments))
	);

describe('Zealot', () => {
	const character = committedCharacter('zealot');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Zealot');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('zealot')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Zealot#Examples)', () => {
		it('Example 1: Zealot skips a vote with three alive', () => {
			// Wiki: "There are 7 players alive. The Zealot votes for the Alsaahir, the Summoner, Ogre,
			// and the Banshee. The next day, there are 5 players alive. The Zealot votes for the
			// Yaggababble, and the High Priestess. The next day, there are 3 players alive. The Zealot
			// votes for the Yaggababble, but chooses not to vote for the High Priestess."
			// The Storyteller's day reminder says the Zealot must vote while 5 or more are alive.
			const s = scenario([
				'zealot',
				'alsaahir',
				'ogre',
				'banshee',
				'highpriestess',
				'yaggababble',
				'witch'
			]);
			expect(zealotLines(s).join(' ')).toMatch(/must vote/);
			const five = s.newDay().dies('alsaahir').dies('ogre');
			expect(zealotLines(five).join(' ')).toMatch(/must vote/);
			const three = five.newDay().dies('banshee').dies('witch');
			expect(zealotLines(three)).toEqual([]);
		});
		it('Example 2: Dead Zealot spends ghost vote late', () => {
			// Wiki: "There are 9 players alive. The Zealot is dead. The Zealot doesn't vote for 3 days,
			// and uses their vote token when just 3 players are alive to vote for the Farmer."
			const s = scenario([
				'zealot',
				'farmer',
				'chef',
				'empath',
				'monk',
				'mayor',
				'soldier',
				'poisoner',
				'witch',
				'imp'
			]).dies('zealot');
			// A dead Zealot has no ability, so nothing makes them vote.
			expect(zealotLines(s)).toEqual([]);
			const late = s
				.newDay()
				.newDay()
				.newDay()
				.dies('chef')
				.dies('empath')
				.dies('monk')
				.dies('mayor')
				.dies('soldier')
				.dies('poisoner')
				.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat('zealot') }));
			expect(late.game.seating.filter((id) => !late.game.seats[id].dead)).toHaveLength(3);
			expect(late.game.seats[late.seat('zealot')].ghostVoteUsed).toBe(true);
		});
	});
});
