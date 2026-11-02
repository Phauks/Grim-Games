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
import { abilityState, protection } from '#lib/core/rules/ability.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { nightTextPlain, nightTextSegments, placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { starPass } from '#lib/core/rules/game-end.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
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
			// How to Run: each night after the first, the Monk picks a player and that player gets Safe.
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Safe]');
		});

		it('allows Safe on any player except the Monk', () => {
			// How to Run: the Monk may not pick themselves; any other player is a valid pick.
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner']).dies('empath');
			const safe = { characterId: 'monk', label: 'Safe' };
			expect(reminderTargetMisses(s.game, safe, s.seat('monk'), s.characters)).toEqual(['self']);
			expect(reminderTargetMisses(s.game, safe, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, safe, s.seat('imp'), s.characters)).toEqual([]);
		});

		it("flags the Safe player as protected on the Demon's night step", () => {
			// How to Run: a Demon attack on the Safe player doesn't kill them, so no death is marked.
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

		it.fails('takes Safe off at dawn', () => {
			// How to Run: the Safe reminder comes off when the day starts.
			// Waits on the engine (unplanned): a new day leaves the Monk's Safe reminder in place.
			const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
				.reminder('chef', 'monk', 'Safe')
				.newDay();
			expect(
				s.game.seats[s.seat('chef')].reminders.filter((r) => r.characterId === 'monk')
			).toEqual([]);
		});

		it.fails("keeps the Safe player from the Demon's poisoning too", () => {
			// How to Run: the protection covers every harmful effect of the Demon's ability, such as
			// poisoning, not only death.
			// Waits on the engine (unplanned): a Demon protection doesn't stop the Demon's own poison.
			const s = scenario(['monk', 'chef', 'pukka', 'empath', 'poisoner'])
				.reminder('chef', 'monk', 'Safe')
				.reminder('chef', 'pukka', 'Poisoned');
			expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(true);
		});
	});
});
