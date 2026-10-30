/** The Demon's info and a Lunatic's fake world (evil-info.ts, decide/bluffs-bag.ts). */
import { describe, expect, it } from 'vitest';
import {
	gameData,
	newGame,
	refused,
	run,
	testContext,
	warned
} from '#lib/core/model/fixtures.test-support.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import type { Script } from '#lib/core/data/index.ts';
import { believedDemon, chosenLikeDemon, demonInfo, fakeEvilInfoOf } from './evil-info.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];
const script: Script = {
	meta: { name: 'Lunatic test' },
	entries: [
		'chef',
		'monk',
		'mayor',
		'magician',
		'poppygrower',
		'lunatic',
		'poisoner',
		'imp',
		'po'
	].map((id) => ({ kind: 'official', id }))
};
const characters = characterLookup(gameData, script);

/** Ana the Lunatic, Ben the Imp, Cat the Poisoner. */
function lunaticGame() {
	const ctx = testContext({ characters });
	const { session, seats } = newGame(names, { ctx, script });
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'lunatic' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: seats[2], characterId: 'poisoner' }
	);
	return { s, ctx, seats };
}

describe('a Lunatic’s fake world', () => {
	// https://wiki.bloodontheclocktower.com/Lunatic: the Lunatic is pointed at any players as
	// Minions; the Storyteller may tell them another player is the Lunatic.
	it('keeps fake Minions and a decoy Lunatic with their picks', () => {
		const { s, ctx, seats } = lunaticGame();
		const set = run(s, ctx, {
			type: 'SetFakeEvilInfo',
			seatId: seats[0],
			info: { minions: [seats[3], seats[3], seats[0]], decoy: seats[6], decoyChose: [seats[5]] }
		});
		// Repeats and the Lunatic themselves are dropped.
		expect(set.game.fakeEvilInfo?.[seats[0]]).toEqual({
			minions: [seats[3]],
			decoy: seats[6],
			decoyChose: [seats[5]]
		});
		expect(
			warned(set, ctx, {
				type: 'SetFakeEvilInfo',
				seatId: seats[0],
				info: { minions: [seats[3]], decoy: seats[6], decoyChose: [seats[5]] }
			})
		).toEqual(['no-change']);
		const cleared = run(set, ctx, {
			type: 'SetFakeEvilInfo',
			seatId: seats[0],
			info: { minions: [] }
		});
		expect(cleared.game.fakeEvilInfo?.[seats[0]]).toBeUndefined();
	});

	it('refuses the Lunatic as their own decoy and warns for a player who is not one', () => {
		const { s, ctx, seats } = lunaticGame();
		expect(
			refused(s, ctx, {
				type: 'SetFakeEvilInfo',
				seatId: seats[0],
				info: { minions: [], decoy: seats[0] }
			})
		).toBe('same-seat');
		expect(
			warned(s, ctx, { type: 'SetFakeEvilInfo', seatId: seats[1], info: { minions: [seats[2]] } })
		).toEqual(['not-a-believer']);
	});

	it('forgets seats that have left the game', () => {
		const { s, ctx, seats } = lunaticGame();
		const set = run(s, ctx, {
			type: 'SetFakeEvilInfo',
			seatId: seats[0],
			info: { minions: [seats[3], seats[7]], decoy: seats[7] }
		});
		const game = { ...set.game, seating: set.game.seating.filter((id) => id !== seats[7]) };
		expect(fakeEvilInfoOf(game, seats[0])).toEqual({ minions: [seats[3]] });
	});

	// https://wiki.bloodontheclocktower.com/Lunatic: the Lunatic may be shown any Demon.
	it('believes the Demon in play unless shown another', () => {
		const { s, seats } = lunaticGame();
		expect(believedDemon(s.game, seats[0], characters)).toBe('imp');
		const tile = {
			tileId: 't1',
			grimoire: 'lunatic',
			shows: 'po',
			reminders: [],
			drawnBySeat: seats[0],
			confirmed: true
		};
		const game = { ...s.game, bag: { tiles: { t1: tile }, order: [], includeTravellers: false } };
		expect(believedDemon(game, seats[0], characters)).toBe('po');
	});

	// The Demon knows who the Lunatic chooses (https://wiki.bloodontheclocktower.com/Lunatic).
	it('lists whom the Lunatic chose', () => {
		const { s, ctx, seats } = lunaticGame();
		const marked = run(s, ctx, {
			type: 'AddReminder',
			seatId: seats[5],
			reminder: { characterId: 'lunatic', label: 'Chosen' }
		});
		expect(chosenLikeDemon(marked.game, seats[0], characters)).toEqual([seats[5]]);
		expect(chosenLikeDemon(marked.game, seats[1], characters)).toEqual([]);
	});
});

describe('Demon info', () => {
	// https://wiki.bloodontheclocktower.com/Magician: the Demon thinks the Magician is a
	// Minion, and Minions think the Magician is a Demon.
	it('shows the Magician to each side as the other', () => {
		const { s, ctx, seats } = lunaticGame();
		const g = run(s, ctx, { type: 'AssignCharacter', seatId: seats[4], characterId: 'magician' });
		expect(demonInfo(g.game, characters)).toEqual({
			shownAsMinions: [seats[4]],
			shownAsDemon: [seats[4]]
		});
	});

	// https://wiki.bloodontheclocktower.com/Poppy_Grower: while it lives, the Demon and
	// Minions don't learn each other.
	it('hides the Minions while a Poppy Grower lives', () => {
		const { s, ctx, seats } = lunaticGame();
		const g = run(s, ctx, {
			type: 'AssignCharacter',
			seatId: seats[4],
			characterId: 'poppygrower'
		});
		expect(demonInfo(g.game, characters).hiddenBy).toBe('poppygrower');
		const dead = run(g, ctx, { type: 'SetDead', seatId: seats[4], dead: true });
		expect(demonInfo(dead.game, characters).hiddenBy).toBeUndefined();
	});
});
