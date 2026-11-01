/**
 * Fearmonger: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fearmonger
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fearmonger.
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

describe('Fearmonger', () => {
	const character = committedCharacter('fearmonger');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Fearmonger');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Fear']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('fearmonger')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fearmonger#Examples)', () => {
		it('Example 1: Chosen Butler executed; evil wins', () => {
			const s = scenario(['butler', 'chef', 'empath', 'fearmonger', 'imp'])
				.reminder('butler', 'fearmonger', 'Fear')
				.newDay()
				.nominate('fearmonger', 'butler')
				.execute('butler');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'nominated-marked-executed', winner: 'evil' }
			]);
		});
		it("Example 2: Another player's nominee executed; no win", () => {
			const s = scenario(['butler', 'chef', 'empath', 'fearmonger', 'imp'])
				.reminder('butler', 'fearmonger', 'Fear')
				.newDay()
				.nominate('chef', 'butler')
				.execute('butler');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it.todo('Example 3: Fearmonger switches from Empath to Soldier');
		it('Example 4: Baron chosen and executed; good wins', () => {
			const s = scenario(['baron', 'chef', 'empath', 'fearmonger', 'imp'])
				.reminder('baron', 'fearmonger', 'Fear')
				.newDay()
				.nominate('fearmonger', 'baron')
				.execute('baron');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'nominated-marked-executed', winner: 'good' }
			]);
		});
	});
});
