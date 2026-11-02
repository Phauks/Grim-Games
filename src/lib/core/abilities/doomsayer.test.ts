/**
 * Doomsayer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Doomsayer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Doomsayer.
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
import { decide } from '#lib/core/engine/index.ts';
import { dayUseUsers, isDayUseAlly } from '#lib/core/rules/day-claims.ts';
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

describe('Doomsayer', () => {
	const character = committedCharacter('doomsayer');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Doomsayer');
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

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('doomsayer')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Doomsayer#Examples)', () => {
		const causes = (s: Scenario, seat: string) =>
			validDeathCauses(s.game, s.seat(seat), s.characters).map((c) => c.cause);

		it('Example 1: Good and evil each sacrifice an ally', () => {
			// Wiki: "The Monk uses the Doomsayer ability, and the Washerwoman dies. Later that day,
			// the Poisoner uses the Doomsayer ability, and the Baron dies."
			const s = scenario(['monk', 'washerwoman', 'poisoner', 'baron', 'imp', 'chef']).rule(
				'doomsayer'
			);
			expect(dayLines(s, 'doomsayer')).toHaveLength(1);
			expect(causes(s, 'washerwoman')).toContain('doomsayer');
			const after = s.dies('washerwoman', 'doomsayer');
			expect(causes(after, 'baron')).toContain('doomsayer');
			const end = after.dies('baron', 'doomsayer');
			expect(end.game.seats[end.seat('washerwoman')].deathCause).toBe('doomsayer');
			expect(end.game.seats[end.seat('baron')].deathCause).toBe('doomsayer');
		});
		it('Example 2: Evil sacrifices continue until the Spy dies', () => {
			// Wiki: "An evil Thief uses the Doomsayer ability, and the Scarlet Woman dies. Later,
			// the Spy uses the Doomsayer ability, and the good Gunslinger dies. Later, the Demon
			// uses the Doomsayer ability, and the Spy dies."
			// Who used it is logged (M15d), so each death is checked against the user's alignment.
			// The Spy may kill a good player because it may register as good: a warning, never a
			// refusal.
			const s = scenario(['thief', 'scarletwoman', 'spy', 'gunslinger', 'imp', 'chef'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'evil' }))
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' }))
				.rule('doomsayer');
			const use = (at: Scenario, by: string, dies: string) =>
				at
					.do({
						type: 'UseAbility',
						seatId: at.seat(by),
						characterId: 'doomsayer',
						on: at.seat(dies)
					})
					.dies(dies, 'doomsayer');
			expect(isDayUseAlly(s.game, s.seat('thief'), s.seat('scarletwoman'))).toBe(true);
			const one = use(s, 'thief', 'scarletwoman');
			expect(isDayUseAlly(one.game, one.seat('spy'), one.seat('gunslinger'))).toBe(false);
			const spyUse = decide(
				one.game,
				{
					type: 'UseAbility',
					seatId: one.seat('spy'),
					characterId: 'doomsayer',
					on: one.seat('gunslinger')
				},
				one.ctx
			);
			expect(spyUse.ok && spyUse.warnings.map((w) => w.code)).toContain('not-ally');
			const two = use(one, 'spy', 'gunslinger');
			expect(isDayUseAlly(two.game, two.seat('imp'), two.seat('spy'))).toBe(true);
			const end = use(two, 'imp', 'spy');
			expect(dayUseUsers(end.game, 'doomsayer')).toEqual([
				end.seat('thief'),
				end.seat('spy'),
				end.seat('imp')
			]);
			for (const dead of ['scarletwoman', 'gunslinger', 'spy'])
				expect(end.game.seats[end.seat(dead)].deathCause).toBe('doomsayer');
		});
	});
});
