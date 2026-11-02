/**
 * Evil Twin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Evil_Twin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Evil Twin.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Evil Twin', () => {
	const character = committedCharacter('eviltwin');

	describe('data (roles.json)', () => {
		it('is a Minion from edition snv', () => {
			expect(character.name).toBe('Evil Twin');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Twin']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('eviltwin')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Evil_Twin#Examples)', () => {
		it('Example 1: Both twins claim Oracle; game continues', () => {
			// Wiki: "Both twins are claiming to be the Oracle. The Evil Twin is executed. The game
			// continues."
			const s = scenario(['oracle', 'chef', 'empath', 'eviltwin', 'nodashii'])
				.reminder('oracle', 'eviltwin', 'Twin')
				.execute('eviltwin');
			expect(s.game.seats[s.seat('eviltwin')].dead).toBe(true);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it('Example 2: Sage-turned Mutant twin executed; evil wins', () => {
			// Wiki: "The Pit-Hag turns the good Sage, who is also the Good Twin, into the Mutant. Both twins
			// try to convince the group that they are the Mutant. The Storyteller immediately executes
			// the Mutant, who is also the Good Twin. The game ends and evil wins."
			const s = scenario(['mutant', 'chef', 'empath', 'eviltwin', 'imp'])
				.reminder('mutant', 'eviltwin', 'Twin')
				.execute('mutant');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'marked-executed', winner: 'evil' }
			]);
		});
		it('Example 3: Wrong twin executed; night deaths stop', () => {
			// Wiki: "The Good Twin and the Evil Twin are both loudly claiming to be the Artist. Both players
			// approach the Storyteller to ask a question in private. The good players, confused, execute
			// the Demon. The game continues, with no death during the night from now on."
			const s = scenario(['artist', 'chef', 'empath', 'eviltwin', 'imp'])
				.reminder('artist', 'eviltwin', 'Twin')
				.execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', holds: [{ rule: 'marked-alive' }] }
			]);
		});
		it.fails('Example 4: New good twin executed; evil wins', () => {
			// Wiki: "The Pit-Hag turns a good player into the Evil Twin, who remains good. The group
			// executes the good-aligned Evil Twin. Evil wins."
			// The new Evil Twin is good, so its twin (marked Twin) is an evil player.
			// Waits on the engine (M15l): the Twin game end reads only the player marked Twin as the good
			// twin, never a good-aligned Evil Twin.
			const s = scenario(['chef', 'empath', 'monk', 'pithag', 'nodashii'])
				.becomes('chef', 'eviltwin', 'good')
				.reminder('pithag', 'eviltwin', 'Twin')
				.execute('chef');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ winner: 'evil' }]);
		});
	});
});
