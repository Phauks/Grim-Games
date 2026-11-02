/**
 * Toymaker: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Toymaker
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Toymaker.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { noAttackState } from '#lib/core/rules/demon-attack.ts';

describe('Toymaker', () => {
	const character = committedCharacter('toymaker');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Toymaker');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Final Night: No Attack']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('toymaker')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Toymaker#Examples)', () => {
		const table = () =>
			scenario(['chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp'])
				.rule('toymaker')
				.reminder('imp', 'toymaker', 'Final Night: No Attack');

		it('Example 1: Imp skips early kill, then strikes later', () => {
			// Wiki: "On the second night, when five players are alive, the Imp chooses not to
			// attack, which allows it to act during the final night. On the third night, when four
			// players are alive, it kills a player."
			// Night two with five alive, the Imp does not attack, so its reminder comes off; night
			// three with four alive, it kills.
			const s = table().dies('chef', 'execution').dies('empath', 'execution');
			const skipped = s.do((at) => ({
				type: 'RemoveReminder',
				reminderId: at.game.seats[at.seat('imp')].reminders[0].reminderId
			}));
			expect(skipped.game.seats[skipped.seat('imp')].reminders).toEqual([]);
			// The Imp's reminder is off, so it may attack tonight with four alive (M15a).
			const night3 = skipped.dies('mayor', 'execution');
			expect(noAttackState(night3.game, night3.seat('imp'), night3.characters).finalNight).toBe(
				false
			);
		});
		it('Example 2: Imp kills early, then blocked at three', () => {
			// Wiki: "On the second night, the Imp kills a player. On the third night, when just
			// three players are alive, the Imp cannot attack because it is the final night."
			// Three alive after the night-two kill: the final night, so the Imp may not attack.
			const s = table()
				.dies('chef', 'execution')
				.dies('empath', 'imp')
				.dies('monk', 'execution')
				.dies('soldier', 'execution');
			expect(s.game.seating.filter((id) => !s.game.seats[id].dead)).toHaveLength(3);
			// The reminder is still on the Imp with three alive: the final night, no attack (M15a).
			expect(noAttackState(s.game, s.seat('imp'), s.characters).finalNight).toBe(true);
		});
	});

	/**
	 * M15a: the Demon's step with the Toymaker in play (`demonAttack`, `rules/demon-attack.ts`).
	 * Seat 0 is the Imp; the Final Night: No Attack token on it means it hasn't yet chosen not
	 * to attack.
	 */
	describe('Demon attack (M15a)', () => {
		const TOKEN = 'Final Night: No Attack';
		const game = () =>
			scenario(['imp', 'washerwoman', 'empath', 'monk', 'soldier', 'chef']).rule('toymaker');
		const kinds = (s: Scenario) => nightStepAlerts(s.game, 'imp', s.characters).map((a) => a.kind);

		it('Example 1: having skipped once, the Imp kills with four alive', () => {
			// Wiki: "On the second night, when five players are alive, the Imp chooses not to attack, which allows it to act during the final night. On the third night, when four players are alive, it kills a player."
			// The skip took the token off; four alive (two dead).
			const k = kinds(game().dies('washerwoman').dies('empath'));
			expect(k).toContain('may-skip-attack');
			expect(k).not.toContain('final-night');
			expect(k).toContain('protected'); // kill alerts still follow: the Soldier
		});

		it('Example 2: never having skipped, the Imp cannot attack with three alive', () => {
			// Wiki: "On the second night, the Imp kills a player. On the third night, when just three players are alive, the Imp cannot attack because it is the final night."
			const k = kinds(
				game().reminder('imp', 'toymaker', TOKEN).dies('washerwoman').dies('empath').dies('monk')
			);
			expect(k).toContain('final-night');
			expect(k).not.toContain('protected');
		});

		it('still marked earlier in the game: a reminder, the attack goes ahead', () => {
			const k = kinds(game().reminder('imp', 'toymaker', TOKEN));
			expect(k).toContain('must-skip-attack');
			expect(k).not.toContain('final-night');
		});
	});
});
