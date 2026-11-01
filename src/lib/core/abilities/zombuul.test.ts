/**
 * Zombuul: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Zombuul
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Zombuul.
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
import { gameEnds, livesWhileDead } from '#lib/core/rules/game-end.ts';
import { diedSinceNewDay } from '#lib/core/rules/night-numbers.ts';
import { wakeConditionMet } from '#lib/core/rules/wakes-when.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Zombuul', () => {
	const character = committedCharacter('zombuul');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Zombuul');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Died Today', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('zombuul')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Zombuul#Examples)', () => {
		it('Example 1: Executed Zombuul appears dead', () => {
			// Wiki: "The Zombuul is executed and appears to die. They cannot attack tonight. A few days
			// later, only two players appear alive on the Town Square. The good team is fairly certain that
			// one of the dead players is the Zombuul, and the game continues until one more player dies."
			const executed = scenario(['zombuul', 'chef', 'empath', 'monk', 'poisoner']).execute(
				'zombuul'
			);
			expect(livesWhileDead(executed.game, executed.seat('zombuul'), executed.characters)).toBe(
				true
			);
			const later = executed.newDay().dies('chef').newDay().dies('empath');
			expect(gameEnds(later.game, later.characters)).toEqual([]);
			// The Zombuul died today, so it does not wake tonight.
			expect(
				wakeConditionMet(
					executed.game,
					'zombuul',
					executed.seat('zombuul'),
					executed.characters,
					new Set()
				)
			).toBe(false);
		});

		it('Example 2: Quiet day brings attack; next night skipped', () => {
			// Wiki: "Nobody died today. That night, the Zombuul attacks. The next day, the Tinker dies. That
			// night, the Zombuul does not wake."
			const quiet = scenario(['zombuul', 'tinker', 'chef', 'empath', 'poisoner']).newDay();
			expect(
				wakeConditionMet(quiet.game, 'zombuul', quiet.seat('zombuul'), quiet.characters, new Set())
			).toBe(true);
			const tinkerDied = quiet.dies('chef', 'zombuul').newDay().dies('tinker', 'tinker');
			// The night order passes who died since the New day, from the log.
			const died = diedSinceNewDay(tinkerDied.session.log.entries.flatMap((e) => e.events));
			expect(
				wakeConditionMet(
					tinkerDied.game,
					'zombuul',
					tinkerDied.seat('zombuul'),
					tinkerDied.characters,
					died
				)
			).toBe(false);
		});
	});
});
