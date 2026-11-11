/**
 * Damsel: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Damsel
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Damsel.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { correctGuesses, dayUseOf } from '#lib/core/rules/day/day-claims.ts';
import { endCharacters } from '#lib/core/rules/game-end/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { shownAtMinionInfo, shownToSeats } from '#lib/core/rules/night/shown-to.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/** Seats with these characters, then the extra commands. */
function table(ids: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(ids.map((_, i) => `P${i}`));
	const s = run(
		session,
		ctx,
		...ids.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((command) => command(seats))
	);
	return { game: s.game, seats };
}

describe('Damsel', () => {
	const character = committedCharacter('damsel');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Damsel');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Guess Used']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('damsel')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Damsel#Examples)', () => {
		it('Example 1: Witch names bluffing Damsel; evil wins', () => {
			// Wiki: "Marianna is the Damsel. She is bluffing as the Lycanthrope. The Witch guesses that
			// Marianna is the Damsel. Evil wins."
			const s = scenario(['damsel', 'witch', 'imp', 'chef', 'monk']);
			const guess = { seatId: s.seat('damsel'), characterId: 'damsel' };
			expect(correctGuesses(s.game, [guess], s.characters)).toEqual([guess]);
			expect(dayUseOf('damsel', s.characters)).toMatchObject({ who: 'guesser' });
			expect(endCharacters(s.game, s.characters)).toContain('damsel');
			// The Witch's guess is logged as the Damsel's ability used, about its guesser.
			const guessed = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('damsel'),
				characterId: 'damsel',
				on: at.seat('witch')
			}));
			expect(gameEnds(guessed.game, guessed.characters)).toMatchObject([
				{ rule: 'used-on-loses', winner: 'evil', characterId: 'damsel' }
			]);
		});
		it("Example 2: After a wrong guess, a Minion's right guess changes nothing", () => {
			// Wiki: "Doug is the Damsel. The Boomdandy guesses that Julian is the Damsel. Nothing
			// happens, and the game continues. The Goblin guesses that Doug is the Damsel. Nothing
			// happens, and the game continues."
			// The Minions share one guess; the Boomdandy spent it on the Chef.
			const s = scenario(['damsel', 'boomdandy', 'goblin', 'imp', 'chef']);
			const wrong = { seatId: s.seat('chef'), characterId: 'damsel' };
			expect(correctGuesses(s.game, [wrong], s.characters)).toEqual([]);
			expect(dayUseOf('damsel', s.characters)?.spentToken).toBe('Guess Used');
			const spent = s.reminder('damsel', 'damsel', 'Guess Used');
			expect(gameEnds(spent.game, spent.characters)).toEqual([]);
			const goblin = spent.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('damsel'),
				characterId: 'damsel',
				on: at.seat('goblin')
			}));
			expect(gameEnds(goblin.game, goblin.characters)).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Damsel#How_to_Run)', () => {
		it('the Guess Used reminder goes on the Damsel only', () => {
			// Wiki: "At any time during the game, if a Minion publicly guesses which player is the Damsel
			// and is incorrect, mark the Damsel with the GUESS USED reminder. Future guesses by Minion
			// players have no effect."
			const s = scenario(['damsel', 'witch', 'imp', 'chef', 'monk']);
			const token = { characterId: 'damsel', label: 'Guess Used' };
			expect(reminderTargetMisses(s.game, token, s.seat('damsel'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('Minions learn at Minion info, so the Damsel step wakes only for a Damsel made since the day', () => {
			// Wiki: "During the first night, wake each Minion. Show the Damsel token. Put each Minion
			// to sleep."
			const s = scenario(['damsel', 'witch', 'imp', 'chef', 'monk']);
			const damsel = s.seat('damsel');
			expect(shownAtMinionInfo(s.game, s.characters)).toEqual(['damsel']);
			expect(wakeConditionMet(s.game, 'damsel', damsel, s.characters, new Set())).toBe(false);
			// A player who became the Damsel since the day began (a Pit-Hag's): the Minions learn now.
			expect(
				wakeConditionMet(s.game, 'damsel', damsel, s.characters, new Set(), new Set([damsel]))
			).toBe(true);
		});

		it("only a Minion's correct guess ends the game", () => {
			// Wiki: "At any time during the game, if a Minion publicly guesses which player is the Damsel
			// and is correct, the game ends. Declare that the evil team wins."
			const s = scenario(['damsel', 'witch', 'imp', 'chef', 'monk']);
			const guessedBy = (guesser: string) =>
				s.do((at) => ({
					type: 'UseAbility',
					seatId: at.seat('damsel'),
					characterId: 'damsel',
					on: at.seat(guesser)
				}));
			const byDemon = guessedBy('imp');
			expect(gameEnds(byDemon.game, byDemon.characters)).toEqual([]);
			const byMinion = guessedBy('witch');
			expect(gameEnds(byMinion.game, byMinion.characters)).toMatchObject([
				{ rule: 'used-on-loses', winner: 'evil' }
			]);
		});
	});
	// "All Minions know a Damsel is in play": each Minion is shown the Damsel token, at Minion
	// info (https://wiki.bloodontheclocktower.com/Damsel).
	describe('Minions are shown the Damsel token', () => {
		it('wakes every Minion, and is one of the cards at Minion info', () => {
			const { game, seats } = table(['damsel', 'poisoner', 'spy', 'imp', 'chef']);
			expect(shownToSeats(game, 'damsel', characters)).toEqual([seats[1], seats[2]]);
			expect(shownAtMinionInfo(game, characters)).toEqual(['damsel']);
		});

		it('is not a card at Minion info without a Damsel in play', () => {
			const { game } = table(['poisoner', 'imp', 'chef']);
			expect(shownAtMinionInfo(game, characters)).toEqual([]);
		});
	});
});
