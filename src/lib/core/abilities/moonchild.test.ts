/**
 * Moonchild: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Moonchild
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Moonchild.
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
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { nightStepAlerts, onDeathApplies, onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Moonchild', () => {
	const character = committedCharacter('moonchild');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Moonchild');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('moonchild')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Moonchild#Examples)', () => {
		const curse = { characterId: 'moonchild', label: 'Dead' };
		const misses = (s: Scenario, on: string) =>
			reminderTargetMisses(s.game, curse, s.seat(on), s.characters);
		const moonchildDayReminders = (s: Scenario) =>
			dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
				.groups.flatMap((g) => g.reminders)
				.filter((r) => r.characterId === 'moonchild');

		it('Example 1: Pukka kills Moonchild; curse takes the Exorcist', () => {
			// Wiki: "The Pukka kills the Moonchild. The next morning, the Moonchild chooses a player, who is
			// the Exorcist. That night, the Exorcist dies."
			const s = scenario(['moonchild', 'exorcist', 'pukka', 'chef', 'poisoner'])
				.dies('moonchild', 'pukka')
				.reminder('exorcist', 'moonchild', 'Dead');
			expect(onDeathApplies(onDeathTrigger('moonchild')!, 'pukka', s.characters)).toBe(true);
			expect(misses(s, 'exorcist')).toEqual([]);
			expect(validDeathCauses(s.game, s.seat('exorcist'), s.characters)).toContainEqual(
				expect.objectContaining({ cause: 'moonchild', flags: [] })
			);
			// Nothing protects the Exorcist from the Moonchild's kill tonight.
			expect(nightStepAlerts(s.game, 'moonchild', s.characters)).toEqual([]);
		});

		it('Example 2: Pacifist saves executed Moonchild; no curse', () => {
			// Wiki: "The Pacifist is in play. The Moonchild is executed but remains alive. The Moonchild does
			// not choose a player, because the Moonchild did not die."
			const s = scenario(['moonchild', 'pacifist', 'imp', 'chef', 'poisoner']);
			const saved = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('moonchild'),
				savedBy: 'pacifist'
			}));
			expect(saved.game.seats[saved.seat('moonchild')].dead).toBe(false);
			expect(moonchildDayReminders(saved)).toEqual([]);
			// Had the execution killed the Moonchild, the day view would prompt its choice.
			expect(moonchildDayReminders(s.execute('moonchild'))).not.toEqual([]);
		});

		it('Example 3: Assassin survives first curse; Gossip dies later', () => {
			// Wiki: "The Shabaloth eats the Moonchild. The Moonchild chooses the Assassin, who remains
			// alive. The Shabaloth regurgitates the Moonchild. A few nights later, the Shabaloth eats the
			// Moonchild again. This time, the Moonchild chooses the Gossip, who dies."
			const eaten = scenario(['moonchild', 'assassin', 'shabaloth', 'gossip', 'chef']).dies(
				'moonchild',
				'shabaloth'
			);
			expect(onDeathApplies(onDeathTrigger('moonchild')!, 'shabaloth', eaten.characters)).toBe(
				true
			);
			expect(misses(eaten, 'assassin')).toEqual(['alignment']);
			expect(
				validDeathCauses(eaten.game, eaten.seat('assassin'), eaten.characters)
			).not.toContainEqual(expect.objectContaining({ cause: 'moonchild' }));
			const again = eaten
				.do((at) => ({ type: 'SetDead', seatId: at.seat('moonchild'), dead: false }))
				.newDay()
				.dies('moonchild', 'shabaloth');
			expect(misses(again, 'gossip')).toEqual([]);
			expect(validDeathCauses(again.game, again.seat('gossip'), again.characters)).toContainEqual(
				expect.objectContaining({ cause: 'moonchild', flags: [] })
			);
		});
	});
});
