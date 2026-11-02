/**
 * Buddhist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Buddhist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Buddhist.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { quietLeft, quietStartRule } from '#lib/core/rules/quiet-start.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
/** A character's day reminders in this scenario: their group and plain text. */
const dayLines = (s: Scenario, characterId: string) =>
	dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders
			.filter((r) => r.characterId === characterId)
			.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
	);

describe('Buddhist', () => {
	const character = committedCharacter('buddhist');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Buddhist');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('buddhist')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Buddhist#Examples)', () => {
		it('Example 1: Veterans quiet early to help newcomers', () => {
			// Wiki: "Lachlan and Lewis are veterans in a game of mostly new players. To encourage
			// the new players to talk, the Storyteller puts the Buddhist in play. Lachlan and Lewis
			// may not talk for the first two minutes each day, after which, they may talk freely."
			// The talking rule is the Storyteller's to run: the day panel says it is in play each day.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('buddhist');
			expect(dayLines(s, 'buddhist')).toEqual([
				{ group: 'announcement', text: '[buddhist] is in play' }
			]);
			expect(dayLines(s.newDay(), 'buddhist')).toHaveLength(1);
		});
		it('Example 2: Minion stays quiet at first, then bluffs', () => {
			// Wiki: "Evin is affected by the Buddhist. He is a Minion and simply listens to what
			// people are saying for the first two minutes, allowing him to bluff as a not-in-play
			// character later on."
			// The Buddhist kills no one and takes no ability away: the Minion keeps theirs.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('buddhist');
			const causes = validDeathCauses(s.game, s.seat('poisoner'), s.characters);
			expect(causes.map((c) => c.cause)).not.toContain('buddhist');
			expect(abilityState(s.game, s.seat('poisoner'), s.characters).works).toBe(true);
		});
	});

	/** M15b: the quiet start the day timer counts down (`quietStart`, `rules/quiet-start.ts`). */
	describe('quiet start (M15b)', () => {
		const s = scenario(['imp', 'washerwoman', 'empath', 'monk', 'soldier']).rule('buddhist');
		const rule = quietStartRule(s.game, s.characters);

		it('Example 1: the veterans are quiet for two minutes of each day, then talk freely', () => {
			// Wiki: "Lachlan and Lewis are veterans in a game of mostly new players. To encourage the new players to talk, the Storyteller puts the Buddhist in play. Lachlan and Lewis may not talk for the first two minutes each day, after which, they may talk freely."
			expect(rule?.players).toBe('veterans');
			expect(rule && quietLeft(rule, 0)).toBe(120_000);
			expect(rule && quietLeft(rule, 119_000)).toBe(1_000);
			expect(rule && quietLeft(rule, 120_000)).toBe(0);
		});

		it('Example 2: the quiet holds whatever the veteran’s alignment', () => {
			// Wiki: "Evin is affected by the Buddhist. He is a Minion and simply listens to what people are saying for the first two minutes, allowing him to bluff as a not-in-play character later on."
			// The rule names no alignment or type: who is a veteran is the Storyteller's call.
			expect(rule).toEqual({ characterId: 'buddhist', seconds: 120, players: 'veterans' });
		});
	});
});
