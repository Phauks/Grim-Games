/**
 * Lunatic: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lunatic
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lunatic.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { believedDemon, believesDemon, chosenLikeDemon } from '#lib/core/rules/evil-info.ts';
import { nightKiller } from '#lib/core/rules/night-alerts.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Lunatic', () => {
	const character = committedCharacter('lunatic');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Lunatic');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Chosen', 'Chosen', 'Chosen']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lunatic')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lunatic#Examples)', () => {
		it('Example 1: Lunatic as Shabaloth: targets never die', () => {
			// Wiki: "The Lunatic, thinking they are the Shabaloth, wakes each night to choose two
			// players. The chosen players do not die."
			const s = scenario(['lunatic', 'chef', 'empath', 'monk', 'poisoner', 'shabaloth'])
				.newDay()
				.reminder('chef', 'lunatic', 'Chosen')
				.reminder('empath', 'lunatic', 'Chosen');
			expect(believesDemon(s.game, s.seat('lunatic'), s.characters)).toBe(true);
			expect(believedDemon(s.game, s.seat('lunatic'), s.characters)).toBe('shabaloth');
			expect(chosenLikeDemon(s.game, s.seat('lunatic'), s.characters)).toEqual([
				s.seat('chef'),
				s.seat('empath')
			]);
			// The Lunatic's choice kills nobody.
			expect(nightKiller('lunatic', s.characters)).toBeUndefined();
			expect(preventedDeaths(s.game, s.characters)).toEqual([]);
		});
		it("Example 2: Real Zombuul mirrors the Lunatic's fake kills", () => {
			// Wiki: "The Lunatic, thinking they are the Zombuul, does not wake often at night. The real
			// Zombuul, who is pretending to be the Lunatic's Minion, often attacks the same players the
			// Lunatic chooses, to keep up the illusion that the Lunatic is the Demon."
			// The Storyteller sees whom the Lunatic chose, and the Zombuul may kill the same player.
			const s = scenario(['lunatic', 'chef', 'empath', 'monk', 'zombuul'])
				.newDay()
				.reminder('chef', 'lunatic', 'Chosen');
			expect(believedDemon(s.game, s.seat('lunatic'), s.characters)).toBe('zombuul');
			expect(chosenLikeDemon(s.game, s.seat('lunatic'), s.characters)).toEqual([s.seat('chef')]);
			const killed = s.reminder('chef', 'zombuul', 'Dead').dies('chef', 'zombuul');
			expect(killed.game.seats[killed.seat('chef')]).toMatchObject({
				dead: true,
				deathCause: 'zombuul'
			});
		});
	});
});
