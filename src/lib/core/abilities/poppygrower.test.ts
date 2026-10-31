/**
 * Poppy Grower: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Poppy_Grower
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Poppy Grower.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { demonInfo } from '#lib/core/rules/evil-info.ts';

describe('Poppy Grower', () => {
	const character = committedCharacter('poppygrower');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Poppy Grower');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Evil Wakes']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('poppygrower')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Poppy_Grower#Examples)', () => {
		it.todo("Example 1: Evil players don't learn each other");
		it.todo('Example 2: Evil learn each other once the Poppy Grower dies');
		it.todo("Example 3: Drunk Poppy Grower's death leaves evil unaware");
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Poppy_Grower): a
// drunk or poisoned Poppy Grower no longer keeps the evil team apart.
describe('Poppy Grower optional rule', () => {
	const cast = ['poppygrower', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'poppygrower', on: true };
	const poisoned = (s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[0],
		reminder: { characterId: 'poisoner', label: 'Poisoned' }
	});

	it('off, a poisoned Poppy Grower still hides the Minions from the Demon', () => {
		const { game } = castGame(cast, poisoned);
		expect(demonInfo(game, characters).hiddenBy).toBe('poppygrower');
	});

	it('on, a sober Poppy Grower hides them', () => {
		const { game } = castGame(cast, on);
		expect(demonInfo(game, characters).hiddenBy).toBe('poppygrower');
	});

	it('on, a poisoned Poppy Grower hides nothing', () => {
		const { game } = castGame(cast, on, poisoned);
		expect(demonInfo(game, characters).hiddenBy).toBeUndefined();
	});
});
