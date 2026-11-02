/**
 * Barista: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Barista
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Barista.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import type { EngineWarning } from '#lib/core/engine/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { withActsTwiceSteps } from '#lib/core/rules/acts-twice.ts';
import { filledInfoToken } from '#lib/core/rules/info-token-characters.ts';
import { infoPicker, reliability, withNightInfo } from '#lib/core/rules/night-info.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { reminderTargetMisses, reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';

const data = committedGameData();
const warnings = (s: Scenario): string[] =>
	((s.session as { warnings?: EngineWarning[] }).warnings ?? []).map((w) => w.code);
const otherNight = (s: Scenario) => {
	const inPlay = s.game.seating.map((seat) => data.byId.get(s.game.seats[seat].characterId!)!);
	const order = nightOrder({
		night: 'other',
		sheet: data.nightSheet,
		inPlay,
		players: inPlay.length
	});
	return withActsTwiceSteps(withNightInfo(order.steps, s.game, s.characters), s.game, s.characters);
};

describe('Barista', () => {
	const character = committedCharacter('barista');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Barista');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Sober & Healthy', 'Acts Twice', '?', '?']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('barista')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Barista#Examples)', () => {
		it('Example 1: Barista makes Sage sober and healthy', () => {
			// Wiki: "The Barista makes the Sage sober and healthy."
			const s = scenario(['barista', 'sage', 'imp', 'poisoner', 'chef']).poisoned('sage');
			expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(false);
			const sober = s.reminder('sage', 'barista', 'Sober & Healthy');
			expect(abilityState(sober.game, sober.seat('sage'), sober.characters).works).toBe(true);
		});

		it('Example 2: Klutz acts twice, then Witch curses twice', () => {
			// Wiki: "The Klutz acts twice. They die and must choose two players. If either is evil, evil
			// wins. The next night, the Barista makes the Witch act twice. Two players are cursed."
			const s = scenario(['barista', 'klutz', 'witch', 'imp', 'chef', 'empath']).reminder(
				'klutz',
				'barista',
				'Acts Twice'
			);
			expect(
				reminderTargetMisses(
					s.game,
					{ characterId: 'barista', label: '?' },
					s.seat('klutz'),
					s.characters
				)
			).toEqual([]);
			// Acting twice uses the ability twice (M15c): the dead Klutz chooses two players with no
			// warning, and the next night the Witch wakes twice and curses two players.
			const dead = s.dies('klutz', 'imp');
			const choose = (at: Scenario, on: string) =>
				at.do({
					type: 'UseAbility',
					seatId: at.seat('klutz'),
					characterId: 'klutz',
					on: at.seat(on)
				});
			expect(warnings(choose(choose(dead, 'chef'), 'imp'))).toEqual([]);
			const next = dead.newDay().reminder('witch', 'barista', 'Acts Twice');
			const witch = otherNight(next).filter((step) => step.character?.id === 'witch');
			expect(witch).toHaveLength(2);
			const cursed = next.reminder('chef', 'witch', 'Cursed').reminder('empath', 'witch', 'Cursed');
			expect(warnings(cursed)).toEqual([]);
		});
	});

	// M15c: the two Barista effects as the engine runs them, written beside the wiki examples
	// above (which another thread owns) so the lead can flip those once both land.
	describe('Barista effects (M15c)', () => {
		it('Sober & Healthy: a poisoned Sage is sober and healthy', () => {
			const s = scenario(['barista', 'sage', 'imp', 'poisoner'])
				.poisoned('sage')
				.reminder('sage', 'barista', 'Sober & Healthy');
			expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
		});

		it('Acts Twice: a dead Klutz chooses two players without a warning', () => {
			const s = scenario(['barista', 'klutz', 'imp', 'chef', 'empath'])
				.reminder('klutz', 'barista', 'Acts Twice')
				.dies('klutz', 'imp');
			const choose = (at: Scenario, on: string) =>
				at.do({
					type: 'UseAbility',
					seatId: at.seat('klutz'),
					characterId: 'klutz',
					on: at.seat(on)
				});
			const twice = choose(choose(s, 'chef'), 'imp');
			expect(warnings(twice)).toEqual([]);
			expect(
				twice.game.today.entries.filter((e) => e.kind === 'ability').map((e) => 'on' in e && e.on)
			).toEqual([s.seat('chef'), s.seat('imp')]);
		});

		it('Acts Twice: the Witch wakes twice the next night, and two players are cursed', () => {
			const s = scenario(['barista', 'witch', 'imp', 'chef', 'empath'])
				.newDay()
				.reminder('witch', 'barista', 'Acts Twice');
			const witch = otherNight(s).filter((step) => step.character?.id === 'witch');
			expect(witch.map((step) => step.again?.seatId)).toEqual([undefined, s.seat('witch')]);
			const cursed = s.reminder('chef', 'witch', 'Cursed').reminder('empath', 'witch', 'Cursed');
			expect(warnings(cursed)).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Barista#How_to_Run)', () => {
		const sober = { characterId: 'barista', label: 'Sober & Healthy' };
		const twice = { characterId: 'barista', label: 'Acts Twice' };

		it('each night places one of Sober & Healthy or Acts Twice, on any player', () => {
			// Wiki: "Each night, remove previous reminders then put the Barista’s SOBER AND HEALTHY
			// reminder or their ACTS TWICE reminder by any character token."
			const either = [
				{
					tokens: [
						{ label: 'Sober & Healthy', action: 'place' },
						{ label: 'Acts Twice', action: 'place' }
					],
					either: true
				}
			];
			expect(placeholdersFor(character, 'first')).toEqual(either);
			expect(placeholdersFor(character, 'other')).toEqual(either);
			const s = scenario(['barista', 'sage', 'imp', 'poisoner', 'chef']).dies('chef');
			for (const token of [sober, twice])
				expect(reminderTargets(s.game, token, s.characters).flatMap((t) => t.misses)).toEqual([]);
			const marked = s.reminder('sage', 'barista', 'Sober & Healthy');
			expect(
				reminderTargetMisses(marked.game, twice, marked.seat('sage'), marked.characters)
			).toEqual(['not-with-label']);
		});

		it.fails("takes the previous night's reminder off before the next night", () => {
			// Wiki: "Each night, remove previous reminders then put the Barista’s SOBER AND HEALTHY
			// reminder or their ACTS TWICE reminder by any character token."
			// Waits on the engine (unplanned): the Barista's reminders have no reminderEnds, so last
			// night's Sober & Healthy stays on its player into the next night.
			const s = scenario(['barista', 'sage', 'imp', 'poisoner', 'chef'])
				.reminder('sage', 'barista', 'Sober & Healthy')
				.newDay()
				.dusk();
			expect(s.game.seats[s.seat('sage')].reminders).toEqual([]);
		});

		it('the chosen player is shown that the Barista selected them', () => {
			// Wiki: "Wake that character’s player and show them the THIS CHARACTER SELECTED YOU info
			// token, the Barista token, then one finger (to show they are sober and healthy) or two
			// fingers (to show they act twice)."
			expect(filledInfoToken(character, 'selected-you', 1)?.characterIds).toEqual(['barista']);
		});

		it('a drunk player marked Sober & Healthy is sober and gets true information', () => {
			// Wiki: "A player marked SOBER AND HEALTHY is sober and healthy (even if they’re also marked
			// DRUNK or POISONED) and always gets true information (even if an ability would make them
			// drunk or poisoned)."
			const s = scenario(['barista', 'empath', 'imp', 'sweetheart', 'chef'])
				.dies('sweetheart')
				.reminder('empath', 'sweetheart', 'Drunk');
			expect(infoPicker(s.game, s.seat('empath'), 'empath', s.characters)?.unreliable).toBe(
				'drunk'
			);
			const sobered = s.reminder('empath', 'barista', 'Sober & Healthy');
			expect(abilityState(sobered.game, sobered.seat('empath'), sobered.characters).works).toBe(
				true
			);
			const picker = infoPicker(
				sobered.game,
				sobered.seat('empath'),
				'empath',
				sobered.characters
			)!;
			expect(picker.unreliable).toBeUndefined();
			expect(picker.range?.truth).toBe(1);
		});

		it('a Townsfolk marked Sober & Healthy gets true information under the Vortox', () => {
			// Wiki: "A player marked SOBER AND HEALTHY is sober and healthy (even if they’re also marked
			// DRUNK or POISONED) and always gets true information (even if an ability would make them
			// drunk or poisoned)."
			const s = scenario(['barista', 'empath', 'vortox', 'witch', 'chef']).reminder(
				'empath',
				'barista',
				'Sober & Healthy'
			);
			expect(
				reliability(s.game, s.seat('empath'), 'empath', s.characters).mustBeFalse
			).toBeUndefined();
		});

		it("the Barista's ? reminders go only on the player who acts twice", () => {
			// Wiki: "Use the Barista’s ? reminders if needed, to substitute for the character’s own
			// reminders."
			const s = scenario(['barista', 'witch', 'imp', 'chef', 'empath']).reminder(
				'witch',
				'barista',
				'Acts Twice'
			);
			const stand = { characterId: 'barista', label: '?' };
			expect(reminderTargetMisses(s.game, stand, s.seat('witch'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, stand, s.seat('chef'), s.characters)).toEqual([
				'with-label'
			]);
		});
	});
});
