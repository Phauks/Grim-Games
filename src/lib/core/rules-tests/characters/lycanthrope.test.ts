/**
 * Lycanthrope: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lycanthrope
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lycanthrope.
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
import { protection } from '#lib/core/rules/abilities/protection.ts';
import { onDeathApplies, onDeathTrigger } from '#lib/core/rules/night/night-alerts.ts';
import { deathVerdict } from '#lib/core/rules/night/night-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';

describe('Lycanthrope', () => {
	const character = committedCharacter('lycanthrope');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Lycanthrope');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Faux Paw', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('lycanthrope')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lycanthrope#Examples)', () => {
		it("Example 1: Lycanthrope kills General; Imp's attack fails", () => {
			// Wiki: "The Lycanthrope attacks the General. The General dies. Later that night, the Imp
			// attacks the Amnesiac. The Amnesiac does not die, because the Imp cannot kill tonight."
			const s = scenario(['lycanthrope', 'general', 'amnesiac', 'chef', 'poisoner', 'imp']);
			expect(
				deathVerdict(
					s.game,
					s.seat('lycanthrope'),
					'lycanthrope',
					{ seatId: s.seat('general') },
					s.characters
				)
			).toMatchObject({
				kind: 'dies',
				seatIds: [s.seat('general')],
				demonKills: false,
				because: 'registers-good'
			});
		});
		it('Example 2: Farmer dies and successor appears; Magician survives', () => {
			// Wiki: "The Lycanthrope attacks the Farmer. The Farmer dies, and another good player becomes
			// a Farmer. The Magician was poisoned by the Pukka last night but does not die tonight,
			// because the Pukka cannot kill tonight."
			const s = scenario([
				'lycanthrope',
				'farmer',
				'magician',
				'chef',
				'poisoner',
				'pukka'
			]).reminder('magician', 'pukka', 'Poisoned');
			expect(
				deathVerdict(
					s.game,
					s.seat('lycanthrope'),
					'lycanthrope',
					{ seatId: s.seat('farmer') },
					s.characters
				)
			).toMatchObject({ kind: 'dies', seatIds: [s.seat('farmer')], demonKills: false });
			// A night death by the Lycanthrope sets off the Farmer.
			const trigger = onDeathTrigger('farmer', s.characters)!;
			expect(onDeathApplies(trigger, 'lycanthrope', s.characters)).toBe(true);
		});
		it('Example 3: Evil target survives; Demon kills the Lycanthrope', () => {
			// Wiki: "The Lycanthrope attacks the Godfather. The Godfather does not die, because the
			// Godfather is evil. The Lycanthrope attacks the Zealot, who is registering as evil due to the
			// Lycanthrope’s ability. The Zealot does not die. The Demon attacks the Lycanthrope and the
			// Lycanthrope dies."
			const s = scenario(['lycanthrope', 'godfather', 'zealot', 'chef', 'empath', 'imp']).reminder(
				'zealot',
				'lycanthrope',
				'Faux Paw'
			);
			const attack = (target: 'godfather' | 'zealot') =>
				deathVerdict(
					s.game,
					s.seat('lycanthrope'),
					'lycanthrope',
					{ seatId: s.seat(target) },
					s.characters
				);
			expect(attack('godfather')).toMatchObject({ kind: 'no-death', because: 'registers-evil' });
			expect(attack('zealot')).toMatchObject({ kind: 'no-death', because: 'registers-evil' });
			// Nothing protects the Lycanthrope from the Demon.
			expect(protection(s.game, s.seat('lycanthrope'), s.characters, 'demon')).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Lycanthrope#How_to_Run)', () => {
		const cast = ['lycanthrope', 'general', 'amnesiac', 'chef', 'poisoner', 'imp'];

		it('lists the Faux Paw reminder to place during setup', () => {
			// Wiki: "During setup, mark one good player with the Lycanthrope’s FAUX PAW reminder."
			const s = scenario(cast);
			expect(setupPrep('lycanthrope', character.name, s.characters)).toMatchObject([
				{ tokens: ['Faux Paw'] }
			]);
		});

		it('puts Faux Paw only on a good player', () => {
			// Wiki: "During setup, mark one good player with the Lycanthrope’s FAUX PAW reminder."
			const s = scenario(cast);
			const fauxPaw = { characterId: 'lycanthrope', label: 'Faux Paw' };
			expect(reminderTargetMisses(s.game, fauxPaw, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, fauxPaw, s.seat('poisoner'), s.characters)).toEqual([
				'alignment'
			]);
		});

		it('marks a good chosen player Dead on nights after the first', () => {
			// Wiki: "Each night except the first, wake the Lycanthrope. They point at any player. Put
			// the Lycanthrope to sleep. If the chosen player is good, that player dies—mark them with the
			// Lycanthrope’s DEAD reminder."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Dead]');
			const s = scenario(cast).newDay().dusk();
			const dead = { characterId: 'lycanthrope', label: 'Dead' };
			expect(reminderTargetMisses(s.game, dead, s.seat('general'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, dead, s.seat('imp'), s.characters)).toEqual([
				'alignment'
			]);
		});
	});
});
