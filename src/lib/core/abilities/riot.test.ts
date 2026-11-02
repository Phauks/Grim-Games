/**
 * Riot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Riot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Riot.
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
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { mayNominate } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Riot', () => {
	const character = committedCharacter('riot');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Riot');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Day 1', 'Day 2', 'Day 3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('riot')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Riot#Examples)', () => {
		it.fails('Example 1: Chain of nominations kills all Riot; good wins', () => {
			// Wiki: "Alex nominates Lewis. Lewis dies and nominates Ben. Ben dies and nominates
			// Marianna. Marianna dies and nominates Lachlan. Lachlan dies. All Riot players are dead.
			// Good wins."
			// Day 3: the Minions are all Riot now, so Lewis, Ben, Marianna and Lachlan are the Riot.
			const s = scenario(['chef', 'riot', 'riot', 'riot', 'riot', 'empath', 'monk'])
				.newDay()
				.newDay();
			const [lewis, ben, marianna, lachlan] = [1, 2, 3, 4];
			const nominee = (at: typeof s, by: number, riot: number) =>
				at.nominate(by, riot).dies(riot, 'riot');
			const first = nominee(s, 0, lewis);
			const end = nominee(nominee(nominee(first, lewis, ben), ben, marianna), marianna, lachlan);
			expect(suggestedWinner(gameEnds(end.game, end.characters))).toBe('good');
			expect(gameEnds(end.game, end.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
			// Waits on the engine (M9): mayNominate says a dead Riot nominee may not nominate, though a
			// Riot nominee who dies nominates again straight away (M9).
			expect(mayNominate(first.game, first.seat(lewis), first.characters)).toBe(true);
		});
	});
});
