/**
 * Nightwatchman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Nightwatchman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Nightwatchman.
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
import { filledInfoToken } from '#lib/core/rules/night/info-token-characters.ts';
import { reliability } from '#lib/core/rules/night/info/reliability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';

describe('Nightwatchman', () => {
	const character = committedCharacter('nightwatchman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Nightwatchman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('nightwatchman')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Nightwatchman#Examples)', () => {
		it('Example 1: Nightwatchman confirms themself to one player', () => {
			// Wiki: "Lachlan is the Nightwatchman. He chooses Abdallah. Abdallah learns that Lachlan is the
			// Nightwatchman."
			const s = scenario(['nightwatchman', 'chef', 'empath', 'poisoner', 'imp']);
			expect(abilityState(s.game, s.seat('nightwatchman'), s.characters).works).toBe(true);
			// The chosen player is shown "This player is" with the Nightwatchman token.
			expect(filledInfoToken(character, 'this-player-is', 1)).toEqual({
				characterIds: ['nightwatchman'],
				upTo: 1
			});
		});
		it("Example 2: Drunk Nightwatchman's target stays asleep", () => {
			// Wiki: "Marianna is the drunk Nightwatchman. She chooses Amy. Amy does not wake, and does not
			// learn that Marianna is the Nightwatchman, because the Nightwatchman has no ability."
			const s = scenario(['nightwatchman', 'chef', 'empath', 'poisoner', 'imp']).drunk(
				'nightwatchman'
			);
			expect(abilityState(s.game, s.seat('nightwatchman'), s.characters)).toMatchObject({
				works: false,
				impairments: [{ reason: 'drunk' }]
			});
		});
		it("Example 3: Vortox makes the Nightwatchman's reveal false", () => {
			// Wiki: "Ben is the Nightwatchman and Vortox is in play. Ben chooses Sarah. Sarah learns that
			// Lewis is the Nightwatchman. Even though the Nightwatchman has their ability, the information
			// is false."
			const s = scenario(['nightwatchman', 'chef', 'empath', 'poisoner', 'vortox']);
			expect(abilityState(s.game, s.seat('nightwatchman'), s.characters).works).toBe(true);
			expect(
				reliability(s.game, s.seat('nightwatchman'), 'nightwatchman', s.characters)
			).toMatchObject({ mustBeFalse: true, falseBy: 'vortox', falseSeat: s.seat('vortox') });
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Nightwatchman#How_to_Run)', () => {
		const cast = ['nightwatchman', 'chef', 'empath', 'poisoner', 'imp'];
		const spent = { characterId: 'nightwatchman', label: 'No Ability' };

		it('marks the Nightwatchman No Ability at its step once they choose a player', () => {
			// Wiki: "The Nightwatchman loses their ability – mark them with a NO ABILITY reminder and
			// remove their night token from the night sheet."
			for (const night of ['first', 'other'] as const) {
				const placeholders = placeholdersFor(character, night);
				const reminder =
					night === 'first' ? character.firstNightReminder! : character.otherNightReminder!;
				const text = nightTextPlain(
					nightTextSegments(reminder, character, { ...(placeholders ? { placeholders } : {}) })
				);
				expect(text).toContain('[+No Ability]');
			}
			const s = scenario(cast);
			expect(reminderTargetMisses(s.game, spent, s.seat('nightwatchman'), s.characters)).toEqual(
				[]
			);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('stops waking the Nightwatchman once they are marked No Ability', () => {
			// Wiki: "Each night, wake the Nightwatchman. The Nightwatchman either shakes their head or
			// points at any player. Put the Nightwatchman to sleep."
			// Wiki: "The Nightwatchman loses their ability – mark them with a NO ABILITY reminder and
			// remove their night token from the night sheet."
			const s = scenario(cast);
			expect(
				wakeConditionMet(s.game, 'nightwatchman', s.seat('nightwatchman'), s.characters, new Set())
			).toBe(true);
			const used = s.reminder('nightwatchman', 'nightwatchman', 'No Ability');
			expect(
				wakeConditionMet(
					used.game,
					'nightwatchman',
					used.seat('nightwatchman'),
					used.characters,
					new Set()
				)
			).toBe(false);
		});
	});
});
