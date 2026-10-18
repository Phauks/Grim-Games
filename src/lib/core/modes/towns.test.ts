/**
 * Towns: Two Towns and a Boomdandy (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/)
 * and Two games at once (Trevor, 2026-10-17).
 */
import { describe, expect, it } from 'vitest';
import { gameModeById } from './registry.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { Bag, Game, ReminderId, Seat, SeatId, Tile } from '#lib/core/model/types.ts';
import {
	canMoveTown,
	inEveryTown,
	movesOnDay,
	moveIntoTown,
	nextPairSeat,
	pairTiles,
	townSizes
} from './towns.ts';

describe('townSizes', () => {
	it('splits as evenly as possible, at most one apart', () => {
		expect(townSizes(12, 2)).toEqual([6, 6]);
		expect(townSizes(13, 2)).toEqual([7, 6]);
	});
});

describe('movesOnDay', () => {
	it('moves 3 after day 1, 2 after days 2 and 3, 1 after days 4 and 5, then none', () => {
		const two = gameModeById('two-towns-and-a-boomdandy')!;
		expect([1, 2, 3, 4, 5, 6].map((d) => movesOnDay(two, d))).toEqual([3, 2, 2, 1, 1, 0]);
		expect(movesOnDay(gameModeById('standard')!, 1)).toBe(0);
	});
});

describe('inEveryTown', () => {
	const mode = gameModeById('two-games-at-once')!;
	it('finds a player who is the Demon in both games', () => {
		expect(
			inEveryTown(mode, [
				{
					playerName: 'Ana',
					characters: [
						{ id: 'imp', type: 'demon' },
						{ id: 'vigormortis', type: 'demon' }
					]
				},
				{
					playerName: 'Ben',
					characters: [
						{ id: 'saint', type: 'outsider' },
						{ id: 'vigormortis', type: 'demon' }
					]
				},
				{ playerName: 'Cy', characters: [{ id: 'imp', type: 'demon' }, undefined] }
			])
		).toEqual([{ playerName: 'Ana', type: 'demon' }]);
	});
});

describe('moving a player to the other town', () => {
	const seat: Seat = {
		seatId: 's1' as SeatId,
		playerName: 'Ana',
		characterId: 'mayor' as CharacterId,
		alignment: 'good',
		dead: false,
		ghostVoteUsed: false,
		overrides: [],
		reminders: [
			{
				reminderId: 'r1' as ReminderId,
				characterId: 'poisoner' as CharacterId,
				label: 'Poisoned' as ReminderLabel
			}
		]
	};

	it('keeps their character, alignment and the reminders on their seat', () => {
		expect(moveIntoTown(seat, 'n1' as SeatId)).toEqual([
			{ type: 'AssignCharacter', seatId: 'n1', characterId: 'mayor', alignment: 'good' },
			{
				type: 'AddReminder',
				seatId: 'n1',
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}
		]);
	});

	it('only moves living players with a character', () => {
		expect(canMoveTown(seat)).toBe(true);
		expect(canMoveTown({ ...seat, dead: true })).toBe(false);
		expect(canMoveTown({ ...seat, characterId: undefined })).toBe(false);
	});
});

describe('pairTiles', () => {
	// One token for both games (Trevor, 2026-10-18).
	const mode = gameModeById('two-games-at-once')!;
	const TYPES: Record<string, 'townsfolk' | 'demon'> = {
		imp: 'demon',
		vigormortis: 'demon',
		chef: 'townsfolk',
		clockmaker: 'townsfolk',
		empath: 'townsfolk',
		dreamer: 'townsfolk'
	};
	const typeOf = (id: CharacterId) => TYPES[id];
	function bag(ids: Record<string, CharacterId>, drawn: Record<string, SeatId> = {}): Bag {
		const tiles: Record<string, Tile> = {};
		for (const [tileId, id] of Object.entries(ids)) {
			tiles[tileId] = {
				tileId,
				shows: id,
				grimoire: id,
				reminders: [],
				confirmed: false,
				...(drawn[tileId] ? { drawnBySeat: drawn[tileId] } : {})
			};
		}
		return { tiles, order: Object.keys(ids), includeTravellers: false };
	}
	function game(prefix: string, characters: (CharacterId | undefined)[]): Game {
		const seating = characters.map((_, i) => `${prefix}${i}`);
		const seats = Object.fromEntries(
			seating.map((id, i) => [id, { characterId: characters[i] } as unknown as Seat])
		);
		return { seating, seats } as unknown as Game;
	}
	const games = [game('a', [undefined, undefined]), game('b', [undefined, undefined])] as const;

	it('pairs tile for tile, and refuses bags of different sizes', () => {
		const pairs = pairTiles(
			mode,
			[bag({ t1: 'chef', t2: 'imp' }), bag({ u1: 'empath', u2: 'vigormortis' })],
			games,
			typeOf
		)!;
		expect(pairs.map((p) => p.tiles)).toEqual([
			['t1', 'u1'],
			['t2', 'u2']
		]);
		expect(pairs.every((p) => p.state === 'in-bag')).toBe(true);
		expect(
			pairTiles(mode, [bag({ t1: 'chef' }), bag({ u1: 'empath', u2: 'imp' })], games, typeOf)
		).toBeUndefined();
	});

	it('never pairs the Demon with the Demon', () => {
		const pairs = pairTiles(
			mode,
			[
				bag({ t1: 'imp', t2: 'chef', t3: 'clockmaker' }),
				bag({ u1: 'vigormortis', u2: 'empath', u3: 'dreamer' })
			],
			[game('a', [undefined, undefined, undefined]), game('b', [undefined, undefined, undefined])],
			typeOf
		)!;
		expect(pairs[0].tiles).toEqual(['t1', 'u2']);
		expect(pairs[1].tiles).toEqual(['t2', 'u1']);
	});

	it('a pair is held by the seat holding either half, and the next seat skips it', () => {
		const pairs = pairTiles(
			mode,
			[
				bag({ t1: 'chef', t2: 'imp' }, { t1: 'a0' }),
				bag({ u1: 'empath', u2: 'vigormortis' }, { u1: 'b0' })
			],
			games,
			typeOf
		)!;
		expect(pairs[0]).toMatchObject({ state: 'held', seat: 0 });
		expect(nextPairSeat(games, pairs)).toBe(1);
	});
});
