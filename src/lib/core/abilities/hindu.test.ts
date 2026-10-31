/**
 * Hindu: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Hindu
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Hindu.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	castGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { gameEnds, promptable } from '#lib/core/rules/game-end.ts';
import { demonHeirs, rebirthOf, reincarnatedBy } from '#lib/core/rules/reincarnation.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

const hindu: Command = { type: 'AddRuleCharacter', characterId: 'hindu' };
const dies =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'demon' });
const reborn =
	(i: number, characterId: string) =>
	(s: string[]): Command => ({ type: 'Reincarnate', seatId: s[i], characterId });

describe('Hindu', () => {
	const character = committedCharacter('hindu');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Hindu');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('hindu')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: the first four players to die, however they die, become Travellers the
	// Storyteller picks, alive, with the alignment they had; after four, death is as normal.
	describe('rebirth', () => {
		const cast = ['princess', 'chef', 'empath', 'monk', 'poisoner', 'imp'];

		it('offers a rebirth to a player who just died', () => {
			const { game, seats } = castGame(cast, hindu, dies(1));
			expect(reincarnatedBy(game, seats[1], characters)).toBe('hindu');
		});

		it('offers none without the Hindu, or to a living player', () => {
			const { game, seats } = castGame(cast, dies(1));
			expect(reincarnatedBy(game, seats[1], characters)).toBeUndefined();
			const living = castGame(cast, hindu);
			expect(reincarnatedBy(living.game, living.seats[2], characters)).toBeUndefined();
		});

		it('keeps an evil player evil', () => {
			const { game, seats } = castGame(cast, hindu, dies(4), reborn(4, 'gunslinger'));
			expect(game.seats[seats[4]]).toMatchObject({ characterId: 'gunslinger', dead: false });
			expect(alignmentOf(game, seats[4])).toBe('evil');
		});

		// A Demon among the first four to die ends the game: good wins, even with a Scarlet
		// Woman alive.
		const executed =
			(i: number) =>
			(s: string[]): Command => ({
				type: 'SetDead',
				seatId: s[i],
				dead: true,
				cause: 'execution'
			});

		it('ends the game for good when the Demon is among the first four to die', () => {
			const { game, seats } = castGame(cast, hindu, executed(5));
			expect(reincarnatedBy(game, seats[5], characters)).toBeUndefined();
			expect(rebirthOf(game, seats[5], characters)).toBe('hindu');
			expect(promptable(gameEnds(game, characters))).toEqual([
				expect.objectContaining({ rule: 'demon-dead', winner: 'good', characterId: 'hindu' })
			]);
		});

		// The Demon is not reborn, so its death works as any Demon's: a Scarlet Woman or a star
		// pass still keeps the game going (Trevor, 2026-10-31).
		it('lets a living Scarlet Woman keep the game going', () => {
			const sw = ['princess', 'chef', 'empath', 'monk', 'scarletwoman', 'imp'];
			const { game } = castGame(sw, hindu, executed(5));
			expect(promptable(gameEnds(game, characters))).toEqual([]);
		});

		it("lets the Imp's star pass keep the game going", () => {
			const { game } = castGame(cast, hindu, dies(5));
			expect(promptable(gameEnds(game, characters))).toEqual([]);
		});

		it('ends it as usual once four have been reborn', () => {
			const { game } = castGame(
				[
					'princess',
					'chef',
					'empath',
					'monk',
					'scarletwoman',
					'imp',
					'mayor',
					'soldier',
					'ravenkeeper',
					'undertaker'
				],
				hindu,
				dies(0),
				reborn(0, 'gunslinger'),
				dies(1),
				reborn(1, 'beggar'),
				dies(2),
				reborn(2, 'thief'),
				dies(3),
				reborn(3, 'bureaucrat'),
				(s) => ({ type: 'SetDead', seatId: s[5], dead: true, cause: 'execution' })
			);
			const [end] = gameEnds(game, characters);
			expect(end.characterId).toBeUndefined();
			expect(end.holds.map((h) => h.rule)).toContain('becomes-demon');
		});

		// The optional rule, when the game turned it on at the start: the Demon becomes a
		// Traveller too, and a living Minion becomes the Demon.
		const optional: Command = { type: 'SetOptionalRule', characterId: 'hindu', on: true };

		it('optional rule: offers the Demon a rebirth while a Minion lives to take it on', () => {
			const { game, seats } = castGame(cast, hindu, optional, dies(5));
			expect(game.optionalRules).toEqual(['hindu']);
			expect(reincarnatedBy(game, seats[5], characters)).toBe('hindu');
			expect(demonHeirs(game, seats[5], 'hindu', characters)).toEqual([seats[4]]);
		});

		it('optional rule: offers none, and good wins, with no living Minion', () => {
			const { game, seats } = castGame(
				cast,
				hindu,
				optional,
				dies(4),
				reborn(4, 'gunslinger'),
				dies(5)
			);
			expect(reincarnatedBy(game, seats[5], characters)).toBeUndefined();
			expect(promptable(gameEnds(game, characters))).toHaveLength(1);
		});

		it('optional rule: off, the Demon has no heirs', () => {
			const { game, seats } = castGame(cast, hindu, dies(5));
			expect(demonHeirs(game, seats[5], 'hindu', characters)).toEqual([]);
		});

		it('optional rule: the Minion becomes the Demon the reborn Demon was', () => {
			const { game, seats } = castGame(
				cast,
				hindu,
				optional,
				dies(5),
				reborn(5, 'gunslinger'),
				(s) => ({ type: 'AssignCharacter', seatId: s[4], characterId: 'imp', alignment: 'evil' })
			);
			expect(game.seats[seats[5]]).toMatchObject({ characterId: 'gunslinger', dead: false });
			expect(alignmentOf(game, seats[5])).toBe('evil');
			expect(game.seats[seats[4]]).toMatchObject({ characterId: 'imp', dead: false });
			expect(gameEnds(game, characters)).toEqual([]);
		});

		it('offers a reborn player none when they die again', () => {
			const { game, seats } = castGame(cast, hindu, dies(1), reborn(1, 'gangster'), dies(1));
			expect(reincarnatedBy(game, seats[1], characters)).toBeUndefined();
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Hindu#Examples)', () => {
		// The Princess is executed and comes back as the Gangster, still good.
		it('Example 1: the executed Princess becomes the Gangster', () => {
			const { game, seats } = castGame(
				['princess', 'chef', 'empath', 'monk', 'poisoner', 'imp'],
				hindu,
				(s) => ({ type: 'SetDead', seatId: s[0], dead: true, cause: 'execution' }),
				reborn(0, 'gangster')
			);
			expect(game.seats[seats[0]]).toMatchObject({ characterId: 'gangster', dead: false });
			expect(alignmentOf(game, seats[0])).toBe('good');
			expect(game.reincarnated).toEqual([seats[0]]);
		});

		// Two players die and are reborn; then the Demon kills three at once, one at a time:
		// the first two are reborn, and the fifth death is a normal one.
		it('Example 2: four rebirths, then the fifth player stays dead', () => {
			const cast = ['sweetheart', 'engineer', 'chef', 'empath', 'monk', 'poisoner', 'po'];
			const first = castGame(
				cast,
				hindu,
				dies(0),
				reborn(0, 'cacklejack'),
				dies(1),
				reborn(1, 'judge'),
				dies(2),
				reborn(2, 'gnome'),
				dies(3),
				reborn(3, 'harlot')
			);
			expect(first.game.reincarnated).toEqual(first.seats.slice(0, 4));
			const { game } = run(first.session, first.ctx, dies(4)(first.seats));
			expect(reincarnatedBy(game, first.seats[4], characters)).toBeUndefined();
		});
	});
});
