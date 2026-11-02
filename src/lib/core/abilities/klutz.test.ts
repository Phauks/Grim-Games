/**
 * Klutz: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Klutz
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Klutz.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { dayUseWho } from '#lib/core/rules/day-claims.ts';
import { endCharacters } from '#lib/core/rules/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Klutz', () => {
	const character = committedCharacter('klutz');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition snv', () => {
			expect(character.name).toBe('Klutz');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('klutz')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Klutz#Examples)', () => {
		it('Example 1: Executed Klutz names a good player', () => {
			// Wiki: "The Klutz dies by execution. After much yelling and confusion, the Klutz chooses a
			// player—who is secretly the Seamstress. Night falls, and the game continues."
			expect(dayUseWho('klutz', undefined)).toBe('chosen');
			const s = scenario(['klutz', 'seamstress', 'chef', 'witch', 'vortox'])
				.execute('klutz')
				.do((at) => ({
					type: 'UseAbility',
					seatId: at.seat('klutz'),
					characterId: 'klutz',
					on: at.seat('seamstress')
				}));
			expect(s.game.seats[s.seat('klutz')]).toMatchObject({ dead: true, deathCause: 'execution' });
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});

		it('Example 2: Killed Klutz picks the Demon; evil wins', () => {
			// Wiki: "The Demon kills Dave, the Klutz. In the morning, when the Storyteller informs the group
			// that Dave is dead, Dave says "Ok everybody, I was the Klutz" and after discussion for a few
			// minutes, Dave publicly chooses the player that is the Demon. The game ends immediately and
			// evil rejoices."
			const s = scenario(['klutz', 'chef', 'empath', 'witch', 'vortox'])
				.dies('klutz', 'vortox')
				.newDay()
				.do((at) => ({
					type: 'UseAbility',
					seatId: at.seat('klutz'),
					characterId: 'klutz',
					on: at.seat('vortox')
				}));
			expect(endCharacters(s.game, s.characters)).toContain('klutz');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ winner: 'evil' }]);
		});
	});
});
