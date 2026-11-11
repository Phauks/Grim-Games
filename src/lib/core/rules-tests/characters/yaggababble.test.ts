/**
 * Yaggababble: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Yaggababble
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Yaggababble.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	nightSheetPresence,
	committedCharacters
} from '#lib/core/testing/committed-data.ts';
import {
	dayReminders,
	dayStateFromGame,
	renderReminder
} from '#lib/core/rules/day/day-reminders.ts';
import { dayTallyOf, tallyKills } from '#lib/core/rules/day/day-tally.ts';
import { decide } from '#lib/core/engine/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The Yaggababble's day reminders, as plain text. */
const yaggababbleLines = (s: Scenario) =>
	dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders
			.filter((r) => r.characterId === 'yaggababble')
			.map((r) => renderReminder(r.segments))
	);

describe('Yaggababble', () => {
	const character = committedCharacter('yaggababble');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Yaggababble');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('yaggababble')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});

		it('keeps a count of the phrase said today, each one a death', () => {
			expect(dayTallyOf('yaggababble', testCharacters)).toEqual({
				label: 'Phrase said today',
				kills: true
			});
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Yaggababble#Examples)', () => {
		it('Example 1: Deaths match how many times the phrase is said', () => {
			// Wiki: "The Yaggababble's phrase is "that sounds fishy". The Yaggababble says this once
			// during the first day. That night, a player dies. The next day, the Yaggababble says
			// "that sounds fishy" three times. That night, three players die."
			const s = scenario(['yaggababble', 'chef', 'empath', 'monk', 'mayor', 'soldier', 'witch'])
				.do({ type: 'SetPrepValue', key: 'yaggababble.phrase', value: 'that sounds fishy' })
				.newDay();
			expect(yaggababbleLines(s).join(' ')).toMatch(/that sounds fishy/);
			const day1 = s.do({ type: 'SetDayTally', characterId: 'yaggababble', count: 1 });
			expect(tallyKills(day1.game, 'yaggababble', day1.characters)).toMatchObject({ left: 1 });
			// That night (the first day's log is still today until dawn): one player dies.
			const night2 = day1.dies('chef', 'yaggababble');
			expect(tallyKills(night2.game, 'yaggababble', night2.characters)).toMatchObject({
				count: 1,
				left: 0,
				over: false
			});
			// The next day starts at none, and three times allows three deaths that night.
			const day2 = night2.newDay();
			expect(tallyKills(day2.game, 'yaggababble', day2.characters)).toMatchObject({
				count: 0,
				left: 0
			});
			const said = day2.do({ type: 'SetDayTally', characterId: 'yaggababble', count: 3 });
			expect(tallyKills(said.game, 'yaggababble', said.characters)?.left).toBe(3);
			const night3 = said
				.dies('empath', 'yaggababble')
				.dies('monk', 'yaggababble')
				.dies('mayor', 'yaggababble');
			expect(tallyKills(night3.game, 'yaggababble', night3.characters)).toMatchObject({
				left: 0,
				over: false
			});
			expect(night3.game.seating.filter((id) => night3.game.seats[id].dead)).toHaveLength(4);
		});
		it("Example 2: Two nominators die from the Demon's ability", () => {
			// Wiki: "The Yaggababble has said their phrase twice today. A Witch is in play. When the
			// Heretic nominates, the Heretic dies, even though they were not cursed by the Witch. The
			// Golem nominates the Demon, and the Golem dies. Both players died due to the
			// Yaggababble's ability."
			const s = scenario(['yaggababble', 'heretic', 'golem', 'chef', 'empath', 'witch', 'monk'])
				.newDay()
				.do({ type: 'SetDayTally', characterId: 'yaggababble', count: 2 })
				.nominate('heretic', 'chef')
				.dies('heretic', 'yaggababble')
				.nominate('golem', 'yaggababble')
				.dies('golem', 'yaggababble');
			expect(s.game.seats[s.seat('heretic')].deathCause).toBe('yaggababble');
			expect(s.game.seats[s.seat('golem')].deathCause).toBe('yaggababble');
			// Both deaths by day use the two times up: no one else may die from it tonight.
			expect(tallyKills(s.game, 'yaggababble', s.characters)).toEqual({
				count: 2,
				died: [s.seat('heretic'), s.seat('golem')],
				left: 0,
				over: false
			});
			// A third death warns, and is still marked: the Storyteller decides.
			const decided = decide(
				s.game,
				{ type: 'SetDead', seatId: s.seat('chef'), dead: true, cause: 'yaggababble' },
				s.ctx
			);
			expect(decided.ok && decided.warnings.map((w) => w.code)).toContain('beyond-tally');
			const third = s.dies('chef', 'yaggababble');
			expect(tallyKills(third.game, 'yaggababble', third.characters)).toMatchObject({
				left: 0,
				over: true
			});
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Yaggababble#How_to_Run)', () => {
		const cast = ['yaggababble', 'chef', 'empath', 'monk', 'witch'];

		it('asks for the secret phrase while preparing the game', () => {
			// Wiki: "During setup, write a phrase on a piece of paper, or on a phone."
			expect(setupPrep('yaggababble', 'Yaggababble', committedCharacters())).toContainEqual(
				expect.objectContaining({ value: { key: 'phrase', label: 'Secret phrase' } })
			);
		});

		it('shows the Demon the phrase on a card on the first night', () => {
			// Wiki: "During the first night, wake the Demon. Show this phrase, then put them to sleep."
			expect(rulesOf('yaggababble', committedCharacters())?.infoCard).toBe('secret-phrase');
		});

		it('counts each time the Demon says the phrase as one death to mark tonight', () => {
			// Wiki: "Each time Demon says the secret phrase, put a DEAD reminder in the center of the left
			// side of the Grimoire, as a reminder to yourself to place it tonight."
			const s = scenario(cast).newDay();
			const said = s
				.do({ type: 'SetDayTally', characterId: 'yaggababble', count: 1 })
				.do({ type: 'SetDayTally', characterId: 'yaggababble', count: 2 });
			expect(tallyKills(said.game, 'yaggababble', said.characters)).toMatchObject({
				count: 2,
				left: 2
			});
		});

		it('lets the Storyteller mark any players Dead tonight, who die as a Demon kill', () => {
			// Wiki: "Each night, you may mark players with these DEAD reminders, and add a shroud to each
			// marked player. These players die."
			const s = scenario(cast).newDay();
			const dead = { characterId: 'yaggababble', label: 'Dead' };
			for (const seat of s.seats)
				expect(reminderTargetMisses(s.game, dead, seat, s.characters)).toEqual([]);
			expect(validDeathCauses(s.game, s.seat('monk'), s.characters).map((c) => c.cause)).toContain(
				'demon'
			);
		});
	});
});
