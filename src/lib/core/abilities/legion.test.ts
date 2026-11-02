/**
 * Legion: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Legion
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Legion.
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
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Legion', () => {
	const character = committedCharacter('legion');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Legion');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'About To Die']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('legion')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'selection', name: 'bag-duplicate' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Legion#Examples)', () => {
		// Waits on the engine: no game end lets evil win once only one good player is alive
		// (Legion's How to Run: the Storyteller may declare it).
		it.fails('Example 1: Two good players, one executed: evil wins', () => {
			// Wiki: "The only good players are the Fortune Teller and the Slayer. 6 Legion and the Slayer
			// vote to execute the Fortune Teller. They are executed, and evil wins."
			const s = scenario([
				'fortuneteller',
				'legion',
				'legion',
				'legion',
				'slayer',
				'legion',
				'legion',
				'legion'
			])
				.newDay()
				.nominate(1, 'fortuneteller')
				.execute('fortuneteller');
			// A good player voted, so the execution stands; one good player is left alive.
			expect(s.game.seats[s.seat('fortuneteller')].dead).toBe(true);
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ winner: 'evil' }]);
		});
		it.fails('Example 2: Zero tally spares one; another dies instead', () => {
			// Wiki: "4 players are alive. 3 Legion and no good players vote to execute Julian. Julian is
			// not executed. Alex, who has 2 votes, 1 of which is a good player, is executed instead. Evil
			// wins."
			// Julian is a Legion; Alex, the Chef, is the only good player alive.
			const s = scenario(['chef', 'legion', 'legion', 'legion', 'empath', 'monk'])
				.dies('empath', 'legion')
				.dies('monk', 'legion')
				.newDay()
				.nominate(2, 1)
				.nominate(3, 'chef');
			expect(s.game.today.entries.filter((e) => e.kind === 'nomination')).toHaveLength(2);
			engineGap(
				'M9',
				"a nomination only evil players voted for has a tally of zero, so Alex's 2 votes win and he is executed, leaving no good player: evil wins"
			);
		});
	});
});
