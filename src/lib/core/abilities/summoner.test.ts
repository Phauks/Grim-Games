/**
 * Summoner: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Summoner
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Summoner.
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

describe('Summoner', () => {
	const character = committedCharacter('summoner');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Summoner');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Night 1', 'Night 2', 'Night 3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('summoner')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Summoner#Examples)', () => {
		it.todo('Example 1: Summoner turns Snitch into Lleech');
		it('Example 2: Summoner executed on day one; good wins', () => {
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'summoner'])
				.newDay()
				.execute('summoner');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'dead-without-demon', winner: 'good' }
			]);
		});
		it.todo('Example 3: Alchemist turned into Leviathan, revealed at dawn');
	});
});
