/**
 * Poppy Grower: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Poppy_Grower
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Poppy Grower.
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
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { demonInfo } from '#lib/core/rules/evil-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

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
		it("Example 1: Evil players don't learn each other", () => {
			// Wiki: "The Imp, the Poisoner and the Witch are in play. On the first night, the Imp wakes
			// to learn 3 not-in-play characters, but does not learn which players are the Minions. The
			// Poisoner and the Witch do not wake to learn who each other are, and do not learn who the
			// Demon is."
			const s = scenario(['poppygrower', 'chef', 'imp', 'poisoner', 'witch', 'empath', 'monk']);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBe('poppygrower');
		});
		it('Example 2: Evil learn each other once the Poppy Grower dies', () => {
			// Wiki: "The Poppy Grower is executed, and dies. That night, the Shabaloth learns which
			// players are the Minions. The Godfather and the Baron wake, make eye contact, and learn
			// which player is the Shabaloth."
			const s = scenario(['poppygrower', 'chef', 'shabaloth', 'godfather', 'baron', 'empath']);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBe('poppygrower');
			const after = s.execute('poppygrower');
			expect(demonInfo(after.game, after.characters).hiddenBy).toBeUndefined();
		});
		it("Example 3: Drunk Poppy Grower's death leaves evil unaware", () => {
			// Wiki: "The Poppy Grower is the Drunk. On the 1st night, the evil players learn who each
			// other are, as normal. On the fourth night, the Demon kills the Poppy Grower. The Demons
			// and Minions do not wake to learn who each other are again because the Poppy Grower is
			// the Drunk."
			const s = scenario(['poppygrower', 'chef', 'imp', 'poisoner', 'empath', 'monk']).drunk(
				'poppygrower'
			);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBeUndefined();
			const later = s.newDay().newDay().newDay().dies('poppygrower', 'imp');
			expect(demonInfo(later.game, later.characters).hiddenBy).toBeUndefined();
		});
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
