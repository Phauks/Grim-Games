/**
 * Philosopher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Philosopher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Philosopher.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { gainedBy } from '#lib/core/rules/gained-abilities.ts';
import { infoPicker, withNightInfo } from '#lib/core/rules/night-info.ts';
import { nightOrder, type Night } from '#lib/core/rules/night-order.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Philosopher', () => {
	const character = committedCharacter('philosopher');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Philosopher');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual(['Is The Philosopher']);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('philosopher')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'reveal', name: 'replace-character' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Philosopher#Examples)', () => {
		/** Tonight's steps for the game as it stands, gained abilities included. */
		const stepsTonight = (s: Scenario, night: Night) => {
			const data = committedGameData();
			const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
			const order = nightOrder({ night, sheet: data.nightSheet, inPlay, players: inPlay.length });
			return withNightInfo(order.steps, s.game, s.characters, night);
		};
		/** The Philosopher's token swapped for a good character not in play. */
		const swapped = (s: Scenario, characterId: string) =>
			s
				.becomes('philosopher', characterId)
				.reminder('philosopher', 'philosopher', 'Is The Philosopher');
		const gainedFrom = rulesOf('philosopher')!.gainedFrom!;

		it('Example 1: Philosopher copies Dreamer on the first night', () => {
			// Wiki: "During the first night, the Philosopher chooses to gain the Dreamer's ability. They
			// gain the Dreamer's ability from now on and act when the Dreamer normally acts."
			const s = swapped(
				scenario(['philosopher', 'chef', 'empath', 'witch', 'nodashii']),
				'dreamer'
			);
			expect(trueCharacter(s.game, s.seat('philosopher'), s.characters)).toBe('philosopher');
			expect(
				gainedBy(s.game, s.seat('philosopher'), 'philosopher', gainedFrom, s.characters)
			).toEqual({ characterId: 'dreamer', status: 'has-ability' });
			for (const night of ['first', 'other'] as const) {
				expect(stepsTonight(s, night).map((step) => step.id)).toContain('dreamer');
			}
		});

		it('Example 2: Philosopher becomes Clockmaker on night three', () => {
			// Wiki: "During the third night, the Philosopher chooses to gain the Clockmaker's ability.
			// That night, they learn the distance from the Demon to their nearest Minion."
			// Waits on the engine (M15k): a Philosopher swapped on a later night for a first-night-only
			// character gets no step that night, so isn't woken for its information.
			const s = swapped(
				scenario(['philosopher', 'nodashii', 'chef', 'witch', 'empath']).newDay().newDay(),
				'clockmaker'
			);
			expect(
				infoPicker(s.game, s.seat('philosopher'), 'clockmaker', s.characters)?.range?.truth
			).toBe(2);
			expect(
				stepsTonight(s, 'other').some(
					(step) => step.id === 'clockmaker' || step.gained?.characterId === 'clockmaker'
				)
			).toBe(true);
		});

		it('Example 3: Copying in-play Artist drunk until Philosopher dies', () => {
			// Wiki: "An Artist is in play. The Philosopher chooses to gain the Artist's ability. The
			// original Artist becomes drunk. Later, the Philosopher dies, so the original Artist becomes
			// sober again. (The original Artist would also become sober if the Philosopher became
			// drunk.)"
			const s = scenario(['philosopher', 'artist', 'chef', 'witch', 'nodashii']).reminder(
				'artist',
				'philosopher',
				'Drunk'
			);
			expect(
				gainedBy(s.game, s.seat('philosopher'), 'philosopher', gainedFrom, s.characters)
			).toMatchObject({ characterId: 'artist', fromSeat: s.seat('artist') });
			expect(abilityState(s.game, s.seat('artist'), s.characters)).toMatchObject({
				works: false,
				impairments: [{ reason: 'drunk', source: { characterId: 'philosopher' } }]
			});
			const dead = s.dies('philosopher', 'nodashii');
			expect(abilityState(dead.game, dead.seat('artist'), dead.characters).works).toBe(true);
			const poisoned = s.reminder('philosopher', 'nodashii', 'Poisoned');
			expect(abilityState(poisoned.game, poisoned.seat('artist'), poisoned.characters).works).toBe(
				true
			);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Philosopher#How_to_Run)', () => {
		const drunk = { characterId: 'philosopher', label: 'Drunk' };
		const swappedMark = { characterId: 'philosopher', label: 'Is The Philosopher' };

		it('each night places either Drunk or Is The Philosopher', () => {
			// Wiki: "Each night, wake the Philosopher. They either shake their head no or point at any
			// Townsfolk icon or any Outsider icon on their character sheet."
			const either = [
				{
					tokens: [
						{ label: 'Drunk', action: 'place' },
						{ label: 'Is The Philosopher', action: 'place' }
					],
					either: true
				}
			];
			expect(placeholdersFor(character, 'first')).toEqual(either);
			expect(placeholdersFor(character, 'other')).toEqual(either);
		});

		it('Is The Philosopher goes on the Philosopher only', () => {
			// Wiki: "If they pointed to an icon of a character not in play, swap the Philosopher token
			// with the chosen character token and mark them with the IS THE PHILOSOPHER reminder."
			const s = scenario(['philosopher', 'artist', 'chef', 'witch', 'nodashii']);
			expect(
				reminderTargetMisses(s.game, swappedMark, s.seat('philosopher'), s.characters)
			).toEqual([]);
			expect(reminderTargetMisses(s.game, swappedMark, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('Drunk goes on the player of a good character in play, never on evil or the Philosopher', () => {
			// Wiki: "If they pointed to an icon of a character in play, the player of the chosen character
			// becomes drunk - mark them with the DRUNK reminder."
			const s = scenario(['philosopher', 'artist', 'mutant', 'witch', 'nodashii']);
			expect(reminderTargetMisses(s.game, drunk, s.seat('artist'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, drunk, s.seat('mutant'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, drunk, s.seat('witch'), s.characters)).not.toEqual([]);
			expect(reminderTargetMisses(s.game, drunk, s.seat('philosopher'), s.characters)).toContain(
				'self'
			);
		});

		it.fails('takes the Drunk reminder off when the Philosopher dies', () => {
			// Wiki: "If the Philosopher dies, the player made drunk by the Philosopher becomes sober -
			// remove the DRUNK reminder."
			// Waits on the engine (unplanned): the Philosopher's death sobers the player but leaves the
			// Drunk reminder on them.
			const s = scenario(['philosopher', 'artist', 'chef', 'witch', 'nodashii'])
				.reminder('artist', 'philosopher', 'Drunk')
				.dies('philosopher', 'nodashii');
			expect(s.game.seats[s.seat('artist')].reminders).toEqual([]);
		});
	});
});
