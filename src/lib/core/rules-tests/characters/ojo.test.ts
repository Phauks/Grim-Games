/**
 * Ojo: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ojo
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ojo.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { plainGame } from '#lib/core/model/fixtures.test-support.ts';
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { killChoice, namedCharacterKill } from '#lib/core/rules/night/chosen-kills.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Ojo', () => {
	const character = committedCharacter('ojo');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Ojo');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('ojo')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ojo#Examples)', () => {
		it('Example 1: Ojo names absent Empath, so Shugenja dies', () => {
			// Wiki: "The Ojo chooses the Plague Doctor. The Plague Doctor dies. The next night, the Ojo
			// chooses the Poppy Grower. The Poppy Grower dies. The next night, the Ojo chooses the Empath.
			// There is no Empath in play, so the Storyteller chooses that the Shugenja dies instead."
			const start = scenario([
				'ojo',
				'plaguedoctor',
				'poppygrower',
				'shugenja',
				'chef',
				'poisoner'
			]);
			expect(killChoice(start.game, 'ojo', start.characters)).toBe('character');
			expect(namedCharacterKill(start.game, 'plaguedoctor', start.characters)).toEqual({
				storytellerChooses: false,
				seats: [start.seat('plaguedoctor')]
			});
			const s = start.dies('plaguedoctor', 'ojo').newDay();
			expect(namedCharacterKill(s.game, 'poppygrower', s.characters).seats).toEqual([
				s.seat('poppygrower')
			]);
			const third = s.dies('poppygrower', 'ojo').newDay();
			const empath = namedCharacterKill(third.game, 'empath', third.characters);
			expect(empath.storytellerChooses).toBe(true);
			expect(empath.seats).toContain(third.seat('shugenja'));
			const after = third.dies('shugenja', 'ojo');
			expect(after.game.seats[after.seat('shugenja')].dead).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Ojo#How_to_Run)', () => {
		it('marks a death with Dead on its step each night after the first', () => {
			// Wiki: "Each night except the first, wake the Ojo. The Ojo player points to a character icon
			// on their character sheet."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Dead]');
			expect(killChoice(plainGame(), 'ojo', scenario(['ojo', 'chef']).characters)).toBe(
				'character'
			);
		});

		it("kills the named character's player as a Demon kill", () => {
			// Wiki: "If that character is in play, that player dies—mark them with the “Dead” reminder."
			const s = scenario(['ojo', 'chef', 'empath', 'monk', 'poisoner']);
			expect(namedCharacterKill(s.game, 'empath', s.characters)).toEqual({
				storytellerChooses: false,
				seats: [s.seat('empath')]
			});
			const dead = { characterId: 'ojo', label: 'Dead' };
			expect(reminderTargetMisses(s.game, dead, s.seat('empath'), s.characters)).toEqual([]);
			const causes = validDeathCauses(s.game, s.seat('empath'), s.characters).map((c) => c.cause);
			expect(causes).toContain('demon');
		});

		it('lets the Storyteller pick any player when the named character is not in play', () => {
			// Wiki: "If that character is not in play, choose any player. That player dies—mark them
			// with the “Dead” reminder."
			const s = scenario(['ojo', 'chef', 'empath', 'monk', 'poisoner']);
			const kill = namedCharacterKill(s.game, 'washerwoman', s.characters);
			expect(kill.storytellerChooses).toBe(true);
			expect(kill.seats).toEqual([...s.seats]);
			const dead = { characterId: 'ojo', label: 'Dead' };
			for (const seat of s.seats)
				expect(reminderTargetMisses(s.game, dead, seat, s.characters)).toEqual([]);
		});
	});
});
