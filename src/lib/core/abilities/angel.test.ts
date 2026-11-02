/**
 * Angel: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Angel
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Angel.
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
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { engineGap, scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The Angel's day reminders, as plain text. */
const angelLines = (s: Scenario) =>
	dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders.filter((r) => r.characterId === 'angel').map((r) => renderReminder(r.segments))
	);

describe('Angel', () => {
	const character = committedCharacter('angel');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Angel');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Protected', 'Protected', 'Something Bad']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('angel')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Angel#Examples)', () => {
		it.fails('Example 1: Demon kills protected player, loses next attack', () => {
			// Wiki: "The Angel protects Sarah. The Demon attacks and kills her. As punishment, the Demon
			// cannot attack on the next night."
			// Sarah is the Chef. The Storyteller marks the Demon Something Bad.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('angel')
				.reminder('chef', 'angel', 'Protected');
			expect(angelLines(s)).toHaveLength(1);
			const after = s.newDay().dies('chef', 'imp').reminder('imp', 'angel', 'Something Bad');
			expect(after.game.seats[s.seat('chef')].dead).toBe(true);
			engineGap(
				'unplanned',
				'the punishment the Storyteller picks for Something Bad, here that the Demon kills no one next night'
			);
		});
		it('Example 2: Protected Demon spared until final-day execution', () => {
			// Wiki: "Ben is the Demon and is protected by the Angel. The players do not execute him
			// until the final day, at which point they may execute him without penalty."
			// The final day: three players alive. Executing the Demon wins for good.
			const s = scenario(['chef', 'imp', 'empath', 'monk', 'poisoner'])
				.rule('angel')
				.reminder('imp', 'angel', 'Protected')
				.dies('monk')
				.dies('poisoner')
				.newDay()
				.execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});
	});
});
