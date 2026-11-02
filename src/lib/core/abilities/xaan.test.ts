/**
 * Xaan: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Xaan
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Xaan.
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
import { setupReminders } from '#lib/core/rules/setup-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** Whether a seat's ability works now. */
const works = (s: Scenario, seat: number) => abilityState(s.game, s.seat(seat), s.characters).works;
/** The Xaan's setup reminder labels. */
const xaanSetup = (s: Scenario) =>
	setupReminders(s.game, s.characters)
		.filter((r) => r.characterId === 'xaan')
		.map((r) => r.label);

describe('Xaan', () => {
	const character = committedCharacter('xaan');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Xaan');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Night 1', 'Night 2', 'Night 3', 'X']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('xaan')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Xaan#Examples)', () => {
		it('Example 1: Three Outsiders: Exorcist, Acrobat, Seamstress misfire', () => {
			// Wiki: "There are 3 Outsiders in play, due to the Xaan. On night 3, the Exorcist chooses
			// the Demon but nothing happens, the Acrobat chooses the Drunk but nothing happens, and the
			// Seamstress gets false information."
			const s = scenario([
				'exorcist',
				'acrobat',
				'seamstress',
				'chef',
				'mutant',
				'sweetheart',
				'xaan',
				'imp'
			])
				.drunk('chef')
				.newDay()
				.newDay()
				.reminder('xaan', 'xaan', 'Night 3')
				.reminder('xaan', 'xaan', 'X');
			for (const id of ['exorcist', 'acrobat', 'seamstress'] as const) {
				expect(abilityState(s.game, s.seat(id), s.characters)).toMatchObject({
					works: false,
					impairments: [{ reason: 'poisoned', source: { characterId: 'xaan' } }]
				});
			}
		});
		it('Example 2: One Outsider: Townsfolk poisoned night one only', () => {
			// Wiki: "There is 1 Outsider in play. It is an 11-player game. On the first night, the Xaan
			// poisons all 7 Townsfolk. On the second night, the Pit-Hag creates a Hatter. Even though
			// there are 2 Outsiders in play, all players are healthy tonight."
			const townsfolk = [0, 1, 2, 3, 4, 5, 6];
			const setup = scenario([
				'chef',
				'empath',
				'monk',
				'mayor',
				'soldier',
				'undertaker',
				'ravenkeeper',
				'saint',
				'xaan',
				'pithag',
				'imp'
			]);
			expect(xaanSetup(setup)).toContain('X');
			const night1 = setup.reminder('xaan', 'xaan', 'Night 1').reminder('xaan', 'xaan', 'X');
			expect(townsfolk.filter((i) => works(night1, i))).toEqual([]);
			// The X comes off at dusk, and the Hatter made tonight doesn't bring it back.
			const x = night1.game.seats[night1.seat('xaan')].reminders.find((r) => r.label === 'X')!;
			const night2 = night1
				.newDay()
				.do({ type: 'RemoveReminder', reminderId: x.reminderId })
				.becomes('chef', 'hatter');
			expect(night2.game.seating.filter((_, i) => !works(night2, i))).toEqual([]);
		});
		it("Example 3: No Outsiders, so Xaan's poison never happens", () => {
			// Wiki: "There are no Outsiders in play. The Xaan never poisons anyone. The Xaan bluffs as
			// the Zealot, and the good team believes that all Townsfolk are poisoned on night 1, but
			// they are not."
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'soldier', 'xaan', 'imp']);
			expect(xaanSetup(s)).not.toContain('X');
			const night1 = s.reminder('xaan', 'xaan', 'Night 1');
			expect([0, 1, 2, 3, 4].filter((i) => !works(night1, i))).toEqual([]);
		});
	});
});
