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
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

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
		it.todo('Example 1: Imp skips early kill, then strikes later');
		it.todo('Example 2: Imp kills early, then blocked at three');
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
