/**
 * Claims players make in town, by their rules block:
 * - https://wiki.bloodontheclocktower.com/Juggler (guesses up to 5 players' characters)
 * - https://wiki.bloodontheclocktower.com/Gossip (a public statement; if true, a player dies)
 * - https://wiki.bloodontheclocktower.com/Savant (two pieces of information, one true)
 * Who a day ability's use is about:
 * - https://wiki.bloodontheclocktower.com/Slayer (publicly chooses a player)
 * - https://wiki.bloodontheclocktower.com/Virgin (the first player to nominate them)
 * - https://wiki.bloodontheclocktower.com/Judge (forces the current execution, after another
 *   player nominated)
 * - https://wiki.bloodontheclocktower.com/Golem (the player they nominate dies unless the Demon)
 * - https://wiki.bloodontheclocktower.com/Psychopath, /Gangster, /Gunslinger (the chosen dies)
 * - https://wiki.bloodontheclocktower.com/Klutz, /Moonchild, /Cacklejack (choose a player)
 * - https://wiki.bloodontheclocktower.com/Damsel (a Minion guesses)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import {
	correctGuesses,
	dayClaim,
	dayUseDeath,
	dayUseOf,
	dayUseSuggestion,
	dayUseWho,
	guessLimit
} from './day-claims.ts';

describe('dayClaim', () => {
	it('reads each character’s claim from its rules block', () => {
		expect(dayClaim('juggler')).toBe('guesses');
		expect(dayClaim('gossip')).toBe('statement');
		expect(dayClaim('savant')).toBe('statements');
		expect(dayClaim('washerwoman')).toBeUndefined();
	});

	it('reads a custom character’s own block', () => {
		const custom = new Map([['herald', { rules: { dayClaim: 'statement' as const } }]]);
		expect(dayClaim('herald', custom)).toBe('statement');
	});
});

describe('dayUseWho', () => {
	it('reads who marking the ability used asks for', () => {
		expect(dayUseWho('slayer')).toBe('chosen');
		expect(dayUseWho('virgin')).toBe('nominator');
		expect(dayUseWho('judge')).toBe('nominee');
		// The Artist's question and the Fisherman's advice are about no player.
		expect(dayUseWho('artist')).toBeUndefined();
		expect(dayUseWho('fisherman')).toBeUndefined();
	});

	it('reads whether the player dies, and the token that marks it used', () => {
		for (const id of ['slayer', 'psychopath', 'gangster', 'gunslinger', 'golem'])
			expect(dayUseOf(id)?.kills, id).toBe(true);
		for (const id of ['klutz', 'moonchild', 'cacklejack', 'damsel', 'virgin'])
			expect(dayUseOf(id)?.kills, id).toBeUndefined();
		expect(dayUseOf('golem')).toEqual({
			who: 'nominated',
			kills: true,
			spentToken: 'May Not Nominate'
		});
		expect(dayUseOf('damsel')).toEqual({ who: 'guesser', spentToken: 'Guess Used' });
	});

	it('reads a custom character’s own block', () => {
		const custom = new Map([['marksman', { rules: { dayUse: { who: 'chosen' as const } } }]]);
		expect(dayUseWho('marksman', custom)).toBe('chosen');
	});
});

describe('dayUseSuggestion', () => {
	const today = () => {
		const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat', 'Dan']);
		const nominate = (nominator: string, nominee: string): Command => ({
			type: 'Nominate',
			nominator,
			nominee
		});
		const s = run(session, ctx, nominate(seats[1], seats[0]), nominate(seats[2], seats[3]));
		return { game: s.game, seats };
	};

	it('fills in the nominator of the seat, and the nominee of another player', () => {
		const { game, seats } = today();
		expect(dayUseSuggestion(game, seats[0], 'nominator')).toBe(seats[1]);
		expect(dayUseSuggestion(game, seats[0], 'nominee')).toBe(seats[3]);
		// The Judge's own nomination does not count: "if another player nominated".
		expect(dayUseSuggestion(game, seats[2], 'nominee')).toBe(seats[0]);
	});

	it('fills in whom the seat nominated (the Golem nominates once)', () => {
		const { game, seats } = today();
		expect(dayUseSuggestion(game, seats[1], 'nominated')).toBe(seats[0]);
		expect(dayUseSuggestion(game, seats[0], 'nominated')).toBeUndefined();
	});

	it('knows nothing of a choice, or of a nomination not logged', () => {
		const { game, seats } = today();
		expect(dayUseSuggestion(game, seats[0], 'chosen')).toBeUndefined();
		expect(dayUseSuggestion(game, seats[2], 'nominator')).toBeUndefined();
	});
});

describe('dayUseDeath', () => {
	const cast = (...ids: string[]) => {
		const { session, ctx, seats } = newGame(ids.map((_, i) => `P${i}`));
		const s = run(
			session,
			ctx,
			...ids.map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			}))
		);
		return { game: s.game, seats, ctx, session: s };
	};

	it('kills the Demon the Slayer shoots, and nobody else', () => {
		const { game, seats } = cast('slayer', 'imp', 'chef', 'baron');
		expect(dayUseDeath(game, 'slayer', seats[1], characters)).toBe('dies');
		expect(dayUseDeath(game, 'slayer', seats[2], characters)).toBe('no');
	});

	it('leaves a Recluse shot by the Slayer to the Storyteller', () => {
		// The Recluse might register as the Demon (https://wiki.bloodontheclocktower.com/Recluse).
		const { game, seats } = cast('slayer', 'imp', 'recluse', 'baron');
		expect(dayUseDeath(game, 'slayer', seats[2], characters)).toBe('maybe');
	});

	it('kills anyone but the Demon the Golem nominates, and nobody already dead', () => {
		const { game, seats, ctx, session } = cast('golem', 'imp', 'chef', 'baron');
		expect(dayUseDeath(game, 'golem', seats[2], characters)).toBe('dies');
		expect(dayUseDeath(game, 'golem', seats[1], characters)).toBe('no');
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[2], dead: true });
		expect(dayUseDeath(dead.game, 'golem', seats[2], characters)).toBe('no');
	});
});

describe('correctGuesses', () => {
	it('counts a guess right only when it names the true character (a Drunk is the Drunk)', () => {
		const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat']);
		const s = run(
			session,
			ctx,
			...(['juggler', 'washerwoman', 'witch'] as const).map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		);
		expect(
			correctGuesses(
				s.game,
				[
					{ seatId: seats[1], characterId: 'washerwoman' },
					{ seatId: seats[2], characterId: 'witch' }
				],
				characters
			)
		).toEqual([{ seatId: seats[2], characterId: 'witch' }]);
	});

	// Wiki Juggler example 2, paraphrased: one player guessed as two characters, and a second
	// player as one of the same characters; only one of the three is right.
	it('takes several guesses of one player, and counts the same guess twice', () => {
		const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat']);
		const s = run(
			session,
			ctx,
			...(['juggler', 'pithag', 'chef'] as const).map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			}))
		);
		const guesses = [
			{ seatId: seats[1], characterId: 'pithag' },
			{ seatId: seats[1], characterId: 'witch' },
			{ seatId: seats[2], characterId: 'pithag' },
			{ seatId: seats[1], characterId: 'pithag' }
		];
		// Trevor, 2026-11-02: the same guess made twice is two guesses, so it counts twice.
		expect(correctGuesses(s.game, guesses, characters)).toEqual([
			{ seatId: seats[1], characterId: 'pithag' },
			{ seatId: seats[1], characterId: 'pithag' }
		]);
	});
});

describe('guessLimit', () => {
	it('is 5 for the Juggler, from its rules block', () => {
		expect(guessLimit('juggler')).toBe(5);
		expect(guessLimit('gossip')).toBeUndefined();
	});
});
