/**
 * Gnome: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gnome
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gnome.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { type Scenario, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Gnome', () => {
	const character = committedCharacter('gnome');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition carousel', () => {
			expect(character.name).toBe('Gnome');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Amigo']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('gnome')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gnome#Examples)', () => {
		// The Gnome's day lines, as plain text.
		const linesOf = (at: Scenario) =>
			dayReminders(
				dayStateFromGame(at.game, (id) => at.characters.get(id), undefined, at.characters)
			)
				.groups.flatMap((g) => g.reminders)
				.filter((r) => r.characterId === 'gnome')
				.map((r) => renderReminder(r.segments));

		it('Example 1: Gnome stays quiet when amigo is nominated', () => {
			// Wiki: "The Gnome starts the game at the same time as the rest of the players, and is good.
			// Amy is the Alsaahir. Before the first night, the Storyteller announces that the Gnome is the
			// same alignment as Amy. The Engineer nominates Amy on day 3. The Gnome does not use their
			// ability."
			const s = scenario(['gnome', 'alsaahir', 'engineer', 'imp', 'poisoner'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('gnome'), alignment: 'good' }))
				.reminder('alsaahir', 'gnome', 'Amigo')
				.newDay()
				.newDay()
				.newDay()
				.nominate('engineer', 'alsaahir');
			expect(linesOf(s)).toEqual(['[gnome · Ana] protects [alsaahir · Ben]']);
			expect(dayUseDeath(s.game, 'gnome', s.seat('engineer'), s.characters)).toBe('dies');
			// The Gnome may choose not to kill: the Engineer lives.
			expect(s.game.seats[s.seat('engineer')].dead).toBe(false);
		});
		it('Example 2: Evil Gnome protects Demon, killing two nominators', () => {
			// Wiki: "The Gnome enters the game on the 2nd day, and is evil. Lewis is the Demon. At this
			// time, the Storyteller announces that the Gnome is the same alignment as Lewis. On the 2nd
			// day, the Boffin nominates Lewis, and is killed by the Gnome. On the 3rd day, the Zealot
			// nominates Lewis, and is killed by the Gnome. On the 4th day, the Village Idiot nominates
			// Lewis, and the Gnome does not use their ability."
			const cast = ['gnome', 'imp', 'boffin', 'zealot', 'villageidiot', 'poisoner', 'chef'];
			const day2 = scenario(cast)
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('gnome'), alignment: 'evil' }))
				.reminder('imp', 'gnome', 'Amigo')
				.newDay()
				.newDay()
				.nominate('boffin', 'imp');
			expect(dayUseDeath(day2.game, 'gnome', day2.seat('boffin'), day2.characters)).toBe('dies');
			const day3 = day2.dies('boffin', 'gnome').newDay().nominate('zealot', 'imp');
			expect(dayUseDeath(day3.game, 'gnome', day3.seat('zealot'), day3.characters)).toBe('dies');
			const day4 = day3.dies('zealot', 'gnome').newDay().nominate('villageidiot', 'imp');
			expect(dayUseDeath(day4.game, 'gnome', day4.seat('villageidiot'), day4.characters)).toBe(
				'dies'
			);
			expect(linesOf(day4)).toEqual(['[gnome · Ana] protects [imp · Ben]']);
			const dead = day4.game.seating.filter((id) => day4.game.seats[id].dead);
			expect(dead).toEqual([day4.seat('boffin'), day4.seat('zealot')]);
		});
	});
});
