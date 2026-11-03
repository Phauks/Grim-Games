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
import { setupPrep, setupReminders } from '#lib/core/rules/setup-reminders.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { remindersEndingAt } from '#lib/core/rules/reminder-ends.ts';
import { nightTextFor } from '#lib/core/rules/night-text.ts';
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Xaan#How_to_Run)', () => {
		const cast = ['chef', 'empath', 'monk', 'saint', 'xaan', 'imp'];

		it('lets the Storyteller deal any number of Outsiders, zero included', () => {
			// Wiki: "While setting up the game, before putting character tokens in the bag, add or remove
			// any number of Outsider tokens, including zero."
			expect(setupModifierFor(character)).toMatchObject({
				ops: [{ kind: 'any', type: 'outsider' }]
			});
		});

		it('counts the nights with Night 1, Night 2 and Night 3 on the Xaan', () => {
			// Wiki: "On the 1st night, add the NIGHT 1 Xaan reminder to the Grimoire. On the 2nd night,
			// add the NIGHT 2 Xaan reminder to the Grimoire. On the 3rd night, add the NIGHT 3 Xaan
			// reminder to the Grimoire."
			expect(setupPrep('xaan', 'Xaan')[0]).toMatchObject({
				tokens: ['Night 1'],
				target: 'the Xaan'
			});
			const s = scenario(cast);
			for (const label of ['Night 1', 'Night 2', 'Night 3', 'X']) {
				const token = { characterId: 'xaan', label };
				expect(reminderTargetMisses(s.game, token, s.seat('xaan'), s.characters)).toEqual([]);
				expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toContain(
					'not-self'
				);
			}
		});

		it('takes X off at the dusk after night X', () => {
			// Wiki: "On the night that equals the number of Outsiders in play when the game began, add the
			// X reminder to the Grimoire, and remove it the following dusk."
			const s = scenario(cast).reminder('xaan', 'xaan', 'X');
			const x = s.game.seats[s.seat('xaan')].reminders.find((r) => r.label === 'X')!;
			expect(remindersEndingAt(s.game, 'dusk', s.characters)).toContain(x.reminderId);
		});

		it('poisons every Townsfolk while X is out, and no one else', () => {
			// Wiki: "When the X reminder is in the Grimoire, all Townsfolk players are poisoned."
			const s = scenario(cast).reminder('xaan', 'xaan', 'X');
			expect([0, 1, 2].filter((i) => works(s, i))).toEqual([]);
			expect(works(s, 3)).toBe(true);
			expect(works(s, 5)).toBe(true);
		});

		it('says in its fuller night text that X poisons the Townsfolk', () => {
			// Wiki: "When the X reminder is in the Grimoire, all Townsfolk players are poisoned."
			for (const night of ['first', 'other'] as const) {
				const text = nightTextFor(character, night, { full: true })?.text;
				expect(text).toMatch(/all Townsfolk are poisoned/);
			}
		});
	});
});
