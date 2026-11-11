/**
 * Courtier: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Courtier
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Courtier.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { countdownMoves } from '#lib/core/rules/reminders/countdown.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { wokeTonight } from '#lib/core/rules/night/woke-tonight.ts';

/** One night's countdown, as the Courtier's step does it: each token swapped for the next. */
function countDown(s: Scenario): Scenario {
	return s.do(
		...countdownMoves(s.game, 'courtier', s.characters).flatMap((m): Command[] => [
			{ type: 'RemoveReminder', reminderId: m.reminderId },
			...(m.to
				? [
						{
							type: 'AddReminder',
							seatId: m.seatId,
							reminder: { characterId: 'courtier', label: m.to }
						} satisfies Command
					]
				: [])
		])
	);
}

describe('Courtier', () => {
	const character = committedCharacter('courtier');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Courtier');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk 3', 'Drunk 2', 'Drunk 1', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('courtier')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Courtier#Examples)', () => {
		it('Example 1: Courtier drunks Shabaloth, which then cannot kill', () => {
			// Wiki: "For four nights, the Courtier wakes but does not use their ability. During the fifth
			// night, they make the Shabaloth drunk. For the next three nights, the Shabaloth acts but
			// cannot kill anybody."
			// The Courtier names the Shabaloth: its player is drunk for three nights and days, the
			// token going Drunk 1, 2, 3 (the wiki's How to Run), then coming off, and the Shabaloth
			// works again.
			let s = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner']).reminder(
				'shabaloth',
				'courtier',
				'Drunk 1'
			);
			const labels: string[] = [];
			for (let night = 0; night < 3; night++) {
				expect(abilityState(s.game, s.seat('shabaloth'), s.characters).works).toBe(false);
				labels.push(s.game.seats[s.seat('shabaloth')].reminders.map((r) => r.label).join());
				s = countDown(s);
			}
			expect(labels).toEqual(['Drunk 1', 'Drunk 2', 'Drunk 3']);
			expect(s.game.seats[s.seat('shabaloth')].reminders).toEqual([]);
			expect(abilityState(s.game, s.seat('shabaloth'), s.characters).works).toBe(true);
		});
		it("Example 2: Drunk Courtier's ability does nothing", () => {
			// Wiki: "The Courtier uses their ability while drunk. Nothing happens, but they are not woken
			// again."
			// The Courtier's player is drunk when they choose, so nobody becomes drunk: the step
			// says their ability doesn't work. A Courtier poisoned after choosing sobers the player.
			const drunk = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner']).drunk(
				'courtier'
			);
			expect(abilityState(drunk.game, drunk.seat('courtier'), drunk.characters).works).toBe(false);
			const poisoned = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner'])
				.reminder('shabaloth', 'courtier', 'Drunk 1')
				.poisoned('courtier');
			expect(
				abilityState(poisoned.game, poisoned.seat('shabaloth'), poisoned.characters).works
			).toBe(true);
		});
		it('Example 3: Drunk Mastermind fails, so good wins', () => {
			// Wiki: "The Courtier makes the Mastermind drunk. The Po is executed while the Mastermind
			// still lives. The game ends and good wins."
			// With the Mastermind drunk, executing the Demon ends the game at once: good wins.
			const s = scenario(['courtier', 'chef', 'empath', 'mastermind', 'po'])
				.reminder('mastermind', 'courtier', 'Drunk 2')
				.execute('po');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Courtier#How_to_Run)', () => {
		const cast = ['courtier', 'chef', 'shabaloth', 'monk', 'poisoner'];
		const nightText = (night: 'first' | 'other') => {
			const source =
				night === 'first' ? character.firstNightReminder : character.otherNightReminder;
			const placeholders = placeholdersFor(character, night);
			return nightTextPlain(
				nightTextSegments(source!, character, { ...(placeholders ? { placeholders } : {}) })
			);
		};

		it('may choose a character, or no one, on the first night and every other night', () => {
			// Wiki: "Each night, wake the Courtier. They either shake their head no or point at any
			// character icon on their character sheet. Put the Courtier to sleep."
			for (const night of ['first', 'other'] as const)
				expect(nightText(night), night).toContain('might choose a character');
		});

		it("makes the chosen character's player drunk while any of the three tokens is on them", () => {
			// Wiki: "If the Courtier chose a character icon and that character is in play, the player
			// of the chosen character becomes drunk for three nights and three days. Tonight, mark them
			// with the Courtier’s DRUNK 1 reminder."
			for (const label of ['Drunk 1', 'Drunk 2', 'Drunk 3']) {
				const s = scenario(cast).reminder('shabaloth', 'courtier', label);
				expect(
					reminderTargetMisses(
						s.game,
						{ characterId: 'courtier', label },
						s.seat('shabaloth'),
						s.characters
					)
				).toEqual([]);
				expect(
					abilityState(s.game, s.seat('shabaloth'), s.characters).impairments,
					label
				).toMatchObject([{ reason: 'drunk', source: { characterId: 'courtier' } }]);
			}
		});

		it('counts the drunk tokens up from Drunk 1 to Drunk 3, then takes Drunk 3 off', () => {
			// Wiki: "The next night, replace the DRUNK 1 reminder with the DRUNK 2 reminder. The next
			// night, replace the DRUNK 2 reminder with the DRUNK 3 reminder. At dusk on the next night,
			// remove the DRUNK 3 reminder"
			// Trevor (2026-11-02): "use the official wiki as only source for order".
			const s = scenario(cast).reminder('shabaloth', 'courtier', 'Drunk 1');
			expect(countdownMoves(s.game, 'courtier', s.characters)).toMatchObject([{ to: 'Drunk 2' }]);
			const two = scenario(cast).reminder('shabaloth', 'courtier', 'Drunk 2');
			expect(countdownMoves(two.game, 'courtier', two.characters)).toMatchObject([
				{ to: 'Drunk 3' }
			]);
			const three = scenario(cast).reminder('shabaloth', 'courtier', 'Drunk 3');
			expect(countdownMoves(three.game, 'courtier', three.characters)[0]).not.toHaveProperty('to');
		});

		it('marks the Courtier No Ability once the drunkenness is placed', () => {
			// Wiki: "and the Courtier loses their ability—mark them with the NO ABILITY reminder"
			const s = scenario(cast);
			const spent = { characterId: 'courtier', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, spent, s.seat('courtier'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).not.toEqual([]);
			expect(nightText('first')).toContain('[+No Ability]');
		});

		it('stops waking the Courtier once they have chosen a character', () => {
			// Wiki: "and remove their night token from the night sheet. After the Courtier chooses a
			// character to make drunk, do not wake the Courtier for the rest of the game."
			const s = scenario(cast).newDay();
			expect(wokeTonight(s.game, s.seat('courtier'), s.characters, 'other')).toBe(true);
			const spent = s.reminder('courtier', 'courtier', 'No Ability');
			expect(wokeTonight(spent.game, spent.seat('courtier'), spent.characters, 'other')).toBe(
				false
			);
		});
	});
});
