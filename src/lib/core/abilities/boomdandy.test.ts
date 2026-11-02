/**
 * Boomdandy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Boomdandy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Boomdandy.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { explosionOf, survivorsLackDemon } from '#lib/core/rules/explosion.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Boomdandy', () => {
	const character = committedCharacter('boomdandy');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Boomdandy');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('boomdandy')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'ability', name: 'pointing', time: 'day' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Boomdandy#Examples)', () => {
		it('Example 1: Pointing kills Widow after explosion; evil wins', () => {
			// Wiki: "Amy is the Boomdandy. She is executed. She explodes, killing all players except for
			// the Po, the Widow, and the Fortune Teller. Frantically, all players start pointing at each
			// other, and talking about who should be pointed at. After counting down, the Storyteller
			// calls “Freeze” and the Widow has the most number of fingers pointed at them, and dies. Evil
			// wins."
			// The Boomdandy is executed: everyone dies but the Po, the Widow and the Fortune Teller.
			// The three point, the Widow is pointed at most and dies, and two players are left.
			const before = scenario([
				'boomdandy',
				'po',
				'widow',
				'fortuneteller',
				'chef',
				'empath',
				'monk'
			]);
			expect(explosionOf(before.game, before.seat('boomdandy'), before.characters)).toEqual({
				characterId: 'boomdandy',
				survivors: 3
			});
			const lives = [before.seat('po'), before.seat('widow'), before.seat('fortuneteller')];
			expect(survivorsLackDemon(before.game, lives, before.characters)).toBe(false);
			const exploded = (['chef', 'empath', 'monk'] as const).reduce(
				(s, id) => s.dies(id, 'boomdandy'),
				before.execute('boomdandy')
			);
			expect(gameEnds(exploded.game, exploded.characters)).toEqual([]);
			const pointed = exploded.dies('widow', 'boomdandy');
			expect(gameEnds(pointed.game, pointed.characters)).toMatchObject([
				{ rule: 'two-alive', winner: 'evil' }
			]);
		});

		it('does not explode when its ability does not work', () => {
			// A poisoned Boomdandy is executed like anyone else.
			const s = scenario(['boomdandy', 'po', 'chef', 'empath', 'poisoner']).poisoned('boomdandy');
			expect(explosionOf(s.game, s.seat('boomdandy'), s.characters)).toBeUndefined();
			expect(explosionOf(s.game, s.seat('chef'), s.characters)).toBeUndefined();
		});
	});
});
