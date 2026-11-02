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
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { engineGap, scenario, type Scenario } from '#lib/core/testing/scenario.ts';

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
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Yaggababble#Examples)', () => {
		it.fails('Example 1: Deaths match how many times the phrase is said', () => {
			// Wiki: "The Yaggababble's phrase is "that sounds fishy". The Yaggababble says this once
			// during the first day. That night, a player dies. The next day, the Yaggababble says
			// "that sounds fishy" three times. That night, three players die."
			const s = scenario(['yaggababble', 'chef', 'empath', 'monk', 'mayor', 'soldier', 'witch'])
				.do({ type: 'SetPrepValue', key: 'yaggababble.phrase', value: 'that sounds fishy' })
				.newDay();
			expect(yaggababbleLines(s).join(' ')).toMatch(/that sounds fishy/);
			const night2 = s.newDay().dies('chef', 'yaggababble');
			const night3 = night2
				.newDay()
				.dies('empath', 'yaggababble')
				.dies('monk', 'yaggababble')
				.dies('mayor', 'yaggababble');
			expect(night3.game.seating.filter((id) => night3.game.seats[id].dead)).toHaveLength(4);
			engineGap(
				'unplanned',
				'a tally of how often the Yaggababble said its phrase today, as the number of players it may kill'
			);
		});
		it.fails("Example 2: Two nominators die from the Demon's ability", () => {
			// Wiki: "The Yaggababble has said their phrase twice today. A Witch is in play. When the
			// Heretic nominates, the Heretic dies, even though they were not cursed by the Witch. The
			// Golem nominates the Demon, and the Golem dies. Both players died due to the
			// Yaggababble's ability."
			const s = scenario(['yaggababble', 'heretic', 'golem', 'chef', 'empath', 'witch', 'monk'])
				.newDay()
				.nominate('heretic', 'chef')
				.dies('heretic', 'yaggababble')
				.nominate('golem', 'yaggababble')
				.dies('golem', 'yaggababble');
			expect(s.game.seats[s.seat('heretic')].deathCause).toBe('yaggababble');
			expect(s.game.seats[s.seat('golem')].deathCause).toBe('yaggababble');
			engineGap(
				'unplanned',
				'the Yaggababble may kill by day, up to the times its phrase was said today'
			);
		});
	});
});
