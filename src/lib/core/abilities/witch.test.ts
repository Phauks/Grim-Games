/**
 * Witch: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Witch
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Witch.
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
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { gameEnds, promptable } from '#lib/core/rules/game-end.ts';
import {
	characterNominationPrompts,
	mayNominate,
	todaysNominations
} from '#lib/core/rules/nominations.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The players the Witch's day reminders name: the cursed player while the curse holds. */
/** The Witch's prompt for a nomination: the cursed nominator dies. */
const curseKills = (s: Scenario, nominator: string, nominee: string) =>
	characterNominationPrompts(
		s.game,
		{ nominator: s.seat(nominator), nominee: s.seat(nominee) },
		s.characters
	).filter((p) => p.characterId === 'witch');

const cursedToday = (s: Scenario) =>
	dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
		.groups.flatMap((g) => g.reminders)
		.filter((r) => r.characterId === 'witch')
		.map((r) => r.target);

describe('Witch', () => {
	const character = committedCharacter('witch');

	describe('data (roles.json)', () => {
		it('is a Minion from edition snv', () => {
			expect(character.name).toBe('Witch');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Cursed']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('witch')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Witch#Examples)', () => {
		it('Example 1: Cursed Sage dies nominating; Dreamer still executed', () => {
			// Wiki: "At night, the Witch curses the Sage. During the next day, the Sage nominates the Dreamer.
			// The Storyteller immediately declares that the player of the Sage dies. The players still vote to
			// execute the Dreamer, who dies too."
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk'])
				.reminder('sage', 'witch', 'Cursed')
				.newDay();
			expect(cursedToday(s)).toEqual([s.seat('sage')]);
			expect(curseKills(s, 'sage', 'dreamer')).toEqual([
				{
					kind: 'kills-nominator',
					characterId: 'witch',
					nominator: s.seat('sage'),
					nominee: s.seat('dreamer')
				}
			]);
			// The Sage dies, and the nomination still stands: the Dreamer is executed.
			const after = s.nominate('sage', 'dreamer').dies('sage', 'witch').execute('dreamer');
			expect(after.game.seats[after.seat('sage')].dead).toBe(true);
			expect(after.game.seats[after.seat('dreamer')].dead).toBe(true);
		});

		it('Example 2: Witch curses self and dies nominating', () => {
			// Wiki: "The Witch curses themself. During the next day, the Witch nominates the Demon, and dies.
			// The players do not vote to execute the Demon, and nominations continue."
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk'])
				.reminder('witch', 'witch', 'Cursed')
				.newDay();
			expect(cursedToday(s)).toEqual([s.seat('witch')]);
			expect(curseKills(s, 'witch', 'imp')).toMatchObject([
				{ kind: 'kills-nominator', nominator: s.seat('witch') }
			]);
			// The Witch dies, and nominations continue.
			const after = s.nominate('witch', 'imp').dies('witch', 'witch');
			expect(mayNominate(after.game, after.seat('chef'), after.characters)).toBe(true);
		});

		it('Example 3: Cursed Klutz turned Fang Gu dies nominating', () => {
			// Wiki: "The Witch curses the Klutz. The Fang Gu attacks the Klutz, so the Klutz becomes the Fang
			// Gu. The new Fang Gu is now cursed by the Witch, and they nominate. The new Fang Gu dies, and
			// good wins."
			const s = scenario(['witch', 'klutz', 'fanggu', 'chef', 'monk', 'sage', 'empath'])
				.reminder('klutz', 'witch', 'Cursed')
				.dies('fanggu', 'fanggu')
				.becomes('klutz', 'fanggu', 'evil')
				.newDay();
			expect(cursedToday(s)).toEqual([s.seat('klutz')]);
			expect(curseKills(s, 'klutz', 'chef')).toMatchObject([
				{ kind: 'kills-nominator', nominator: s.seat('klutz') }
			]);
			// Once the curse kills the new Fang Gu, no Demon is left alive.
			const killed = s.nominate('klutz', 'chef').dies('klutz', 'witch');
			expect(promptable(gameEnds(killed.game, killed.characters))).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});

		it('Example 4: Curse ends at three alive; Savant safe', () => {
			// Wiki: "The Witch curses the Savant. Later that night, after the Demon kills a player, only three
			// players are alive, so the curse is removed. The Savant may nominate safely."
			const s = scenario(['witch', 'savant', 'imp', 'chef', 'monk', 'empath'])
				.reminder('savant', 'witch', 'Cursed')
				.dies('chef')
				.dies('monk');
			expect(abilityState(s.game, s.seat('witch'), s.characters).works).toBe(true);
			const three = s.dies('empath', 'imp');
			expect(abilityState(three.game, three.seat('witch'), three.characters)).toMatchObject({
				works: false,
				impairments: [{ reason: 'no-ability', source: { characterId: 'witch' } }]
			});
			// The day view says the Witch has no ability instead of naming the Savant.
			expect(cursedToday(three.newDay())).not.toContain(three.seat('savant'));
		});

		it("Example 5: Exiling a Traveller doesn't trigger the curse", () => {
			// Wiki: "The Witch curses the Juggler. During the next day, the Juggler calls for the exile of a
			// Traveller. The Juggler lives, and may nominate again, because abilities do not affect exiles."
			const s = scenario(['witch', 'juggler', 'imp', 'chef', 'monk', 'thief'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'good' }))
				.reminder('juggler', 'witch', 'Cursed')
				.newDay()
				.do((at) => ({ type: 'Exile', seatId: at.seat('thief') }));
			expect(todaysNominations(s.game)).toEqual([]);
			expect(s.game.seats[s.seat('juggler')].dead).toBe(false);
			expect(mayNominate(s.game, s.seat('juggler'), s.characters)).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Witch#How_to_Run)', () => {
		it('places Cursed each night, on any player', () => {
			// Wiki: "Each night, wake the Witch. They point at any player. Put the Witch to sleep. Mark the
			// chosen player with the CURSED reminder."
			const place = [{ tokens: [{ label: 'Cursed', action: 'place' }] }];
			expect(placeholdersFor(character, 'first')).toEqual(place);
			expect(placeholdersFor(character, 'other')).toEqual(place);
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk']).dies('chef');
			const cursed = { characterId: 'witch', label: 'Cursed' };
			expect(reminderTargets(s.game, cursed, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});

		it('only the cursed player dies for nominating, and the Witch is the cause', () => {
			// Wiki: "The next day, if the player marked CURSED makes a nomination, immediately declare that
			// they die."
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk'])
				.reminder('sage', 'witch', 'Cursed')
				.newDay();
			expect(curseKills(s, 'chef', 'imp')).toEqual([]);
			const nominated = s.nominate('sage', 'imp');
			expect(
				validDeathCauses(nominated.game, nominated.seat('sage'), nominated.characters, {
					day: true
				})
			).toContainEqual(expect.objectContaining({ cause: 'witch', flags: [] }));
		});

		it('other players may still nominate after the cursed player dies', () => {
			// Wiki: "(Nominations continue as normal.)"
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk'])
				.reminder('sage', 'witch', 'Cursed')
				.newDay()
				.nominate('sage', 'imp')
				.dies('sage', 'witch');
			expect(mayNominate(s.game, s.seat('dreamer'), s.characters)).toBe(true);
			expect(curseKills(s, 'dreamer', 'imp')).toEqual([]);
		});

		it.fails("last night's curse no longer kills on a later day", () => {
			// Wiki: "The next day, if the player marked CURSED makes a nomination, immediately declare that
			// they die."
			// Waits on the engine (unplanned): Cursed has no reminderEnds, so a curse left from an earlier
			// night still prompts a death on every later day.
			const s = scenario(['witch', 'sage', 'dreamer', 'imp', 'chef', 'monk'])
				.reminder('sage', 'witch', 'Cursed')
				.newDay()
				.newDay();
			expect(curseKills(s, 'sage', 'imp')).toEqual([]);
		});
	});
});
