/**
 * Monk: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Monk
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Monk.
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
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { protection } from '#lib/core/rules/abilities/protection.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { starPass } from '#lib/core/rules/game-end/game-end.ts';
import { preventedDeaths } from '#lib/core/rules/day/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Monk', () => {
	const character = committedCharacter('monk');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Monk');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Safe']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('monk')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Monk#Examples)', () => {
		it("Example 1: Monk shields Fortune Teller from Imp's attack", () => {
			// Wiki: "The Monk protects the Fortune Teller. The Imp attacks the Fortune Teller. No deaths
			// occur tonight."
			const s = scenario(['monk', 'fortuneteller', 'imp', 'chef', 'poisoner'])
				.reminder('fortuneteller', 'monk', 'Safe')
				.reminder('fortuneteller', 'imp', 'Dead');
			expect(protection(s.game, s.seat('fortuneteller'), s.characters, 'demon')).toMatchObject({
				characterId: 'monk',
				seatId: s.seat('monk')
			});
			expect(preventedDeaths(s.game, s.characters).map((p) => p.seatId)).toEqual([
				s.seat('fortuneteller')
			]);
		});
		it('Example 2: Imp targets protected Mayor; no deaths', () => {
			// Wiki: "The Monk protects the Mayor, and the Imp attacks the Mayor. The Mayor's "another
			// player dies" ability does not trigger, because the Mayor is safe from the Imp. Nobody dies
			// tonight."
			// The Mayor is safe from the Imp, so the Mayor's "another player dies" never comes up.
			const s = scenario(['monk', 'mayor', 'imp', 'chef', 'poisoner'])
				.reminder('mayor', 'monk', 'Safe')
				.reminder('mayor', 'imp', 'Dead');
			const [survivor] = preventedDeaths(s.game, s.characters);
			expect(survivor.because.map((b) => b.kind)).toEqual(['protected']);
		});
		it('Example 3: Imp self-kills under protection, staying alive', () => {
			// Wiki: "The Monk protects the Imp . The Imp chooses to kill themself tonight, but nothing
			// happens. The Imp stays alive and a new Imp is not created."
			// The protected Imp doesn't die, so no Minion becomes the Imp.
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
				.reminder('imp', 'monk', 'Safe')
				.reminder('imp', 'imp', 'Dead');
			expect(protection(s.game, s.seat('imp'), s.characters, 'demon')).toMatchObject({
				characterId: 'monk'
			});
			expect(starPass(s.game, s.characters)).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Monk#How_to_Run)', () => {
		it("the Monk's step on other nights places Safe on the chosen player", () => {
			// Wiki: "Each night except the first, wake the Monk."
			// Wiki: "Put the Monk's SAFE reminder token by the chosen player's character token."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Safe]');
		});

		it('allows Safe on any player except the Monk', () => {
			// Wiki: "The Monk points at any player except themself. (If the Monk points at themself,
			// shake your head no and prompt them to point at another player.)"
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner']).dies('empath');
			const safe = { characterId: 'monk', label: 'Safe' };
			expect(reminderTargetMisses(s.game, safe, s.seat('monk'), s.characters)).toEqual(['self']);
			expect(reminderTargetMisses(s.game, safe, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, safe, s.seat('imp'), s.characters)).toEqual([]);
		});

		it("flags the Safe player as protected on the Demon's night step", () => {
			// Wiki: "If the Demon attacks the player marked SAFE, the player remains alive. (Do not mark
			// them with the Demon's DEAD reminder token or add a shroud as you normally would.)"
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner']).reminder(
				'chef',
				'monk',
				'Safe'
			);
			expect(nightStepAlerts(s.game, 'imp', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'protected',
					seatId: s.seat('chef'),
					source: expect.objectContaining({ characterId: 'monk', seatId: s.seat('monk') }),
					works: true
				})
			);
		});

		it('takes Safe off at dawn', () => {
			// Wiki: "At dawn, remove the SAFE reminder token."
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
				.reminder('chef', 'monk', 'Safe')
				.newDay();
			expect(
				s.game.seats[s.seat('chef')].reminders.filter((r) => r.characterId === 'monk')
			).toEqual([]);
		});

		it("keeps the Safe player from the Demon's poisoning too", () => {
			// Wiki: "The Monk's protection also prevents all other harmful effects of the Demon's
			// ability, such as poisoning or turning the protected player evil."
			const s = scenario(['monk', 'chef', 'pukka', 'empath', 'poisoner'])
				.reminder('chef', 'monk', 'Safe')
				.reminder('chef', 'pukka', 'Poisoned');
			expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(true);
		});
	});
});
