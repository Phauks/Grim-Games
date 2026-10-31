/**
 * Mastermind: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mastermind
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mastermind.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Mastermind', () => {
	const character = committedCharacter('mastermind');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Mastermind');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('mastermind')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mastermind#Examples)', () => {
		it('Example 1: Demon dead, good player executed: evil wins', () => {
			const s = scenario(['professor', 'chef', 'empath', 'mastermind', 'shabaloth'])
				.newDay()
				.execute('shabaloth')
				.newDay()
				.execute('professor');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ rule: 'extra-day', winner: 'evil' }]);
		});
		it.todo('Example 2: Protected evil player executed; good wins anyway');
		it.todo("Example 3: Zombuul's second death extends the game a day");
		it('Example 4: Two alive, no execution: good wins', () => {
			const s = scenario(['chef', 'empath', 'mastermind', 'imp'])
				.dies('empath', 'demon')
				.newDay()
				.execute('imp')
				.newDay();
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'extra-day', winner: 'good' }
			]);
		});
	});
});
