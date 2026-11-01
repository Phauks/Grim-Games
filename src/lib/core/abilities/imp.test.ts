/**
 * Imp: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Imp
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Imp.
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
import { demonInfo } from '#lib/core/rules/evil-info.ts';
import { gameEnds, starPass, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Imp', () => {
	const character = committedCharacter('imp');

	describe('data (roles.json)', () => {
		it('is a Demon from edition tb', () => {
			expect(character.name).toBe('Imp');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('imp')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Imp#Examples)', () => {
		it('Example 1: Imp bluffs Chef, switches to Mayor', () => {
			// Wiki: "It is the first night. The Imp learns that Evin and Sarah are the Minions. The Imp
			// also learns that the Monk, Chef, and Librarian are not in play. The Imp bluffs as the Chef,
			// then bluffs as Mayor halfway through the game. Eventually, the Imp is executed and good
			// wins."
			// On the first night the Imp learns its Minions (nothing hides them) and three
			// characters not in play. When the Imp is executed, good wins.
			const s = scenario(['imp', 'poisoner', 'spy', 'empath', 'saint', 'soldier', 'virgin']).do({
				type: 'SetBluffs',
				set: 0,
				characterIds: ['monk', 'chef', 'librarian']
			});
			expect(demonInfo(s.game, s.characters)).toEqual({ shownAsMinions: [], shownAsDemon: [] });
			expect(s.game.bluffs[0]).toEqual(['monk', 'chef', 'librarian']);
			const ends = gameEnds(s.newDay().execute('imp').game, s.characters);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 2: Imp kills itself; Poisoner becomes the Imp', () => {
			// Wiki: "During the night, the Imp wakes and chooses a player, who dies. The next night, the
			// Imp chooses themselves to die. The Imp dies, and the Poisoner becomes the Imp."
			const s = scenario(['imp', 'poisoner', 'chef', 'empath', 'monk'])
				.dies('chef', 'imp')
				.newDay()
				.dies('imp', 'imp');
			expect(starPass(s.game, s.characters)).toMatchObject({
				characterId: 'imp',
				heirs: [s.seat('poisoner')]
			});
			const after = s.becomes('poisoner', 'imp');
			expect(gameEnds(after.game, after.characters)).toEqual([]);
		});
	});
});
