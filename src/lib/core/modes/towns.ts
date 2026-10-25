/**
 * More than one town in one game (part `towns`): Two Towns and a Boomdandy splits the players
 * between two towns and moves some across each day
 * (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/); Two games at once seats
 * every player in both, never the Demon in both (Trevor, 2026-10-17). Each town is an
 * ordinary saved game; these helpers only plan and check across them.
 */
import type { CharacterId, CharacterType, PlayerName } from '#lib/core/data/types.ts';
import type { SeatedType } from '#lib/core/rules/distribution.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import type { Bag, Game, Seat, SeatId, TileId } from '#lib/core/model/types.ts';
import type { GameMode } from './types.ts';

/** Players per town, as even as possible, earlier towns taking the extra players. */
export function townSizes(players: number, towns: number): number[] {
	const n = Math.max(1, Math.floor(towns));
	const base = Math.floor(players / n);
	return Array.from({ length: n }, (_, i) => base + (i < players % n ? 1 : 0));
}

/** Players the representative moves at the end of `day` (1-based); 0 when the rule has none. */
export function movesOnDay(mode: GameMode, day: number): number {
	const step = mode.parts.daySteps?.find((s) => s.kind === 'town-representative');
	if (!step || step.kind !== 'town-representative') return 0;
	return step.movesPerDay[day - 1] ?? 0;
}

/** One player's characters, town by town (undefined where they have none yet). */
export interface PlayerAcrossTowns {
	playerName: PlayerName;
	characters: ({ id: CharacterId; type: CharacterType } | undefined)[];
}

/**
 * Players with a character of a type the mode keeps to one town (`notInEveryTown`) in every
 * town, e.g. the Demon in both games. A warning only; the Storyteller decides.
 */
export function inEveryTown(
	mode: GameMode,
	players: readonly PlayerAcrossTowns[]
): { playerName: PlayerName; type: SeatedType }[] {
	const types = mode.parts.towns?.notInEveryTown ?? [];
	const towns = mode.parts.towns?.count ?? 1;
	const out: { playerName: PlayerName; type: SeatedType }[] = [];
	for (const p of players) {
		if (p.characters.length < towns) continue;
		for (const type of types) {
			if (p.characters.every((c) => c?.type === type)) out.push({ playerName: p.playerName, type });
		}
	}
	return out;
}

/**
 * A living player with a character can move to the other town (dead players can't, per the
 * rules above).
 */
export function canMoveTown(seat: Seat): boolean {
	return !seat.dead && seat.characterId !== undefined;
}

/**
 * What puts a moved player into their new town, on the seat just added there: they keep
 * their character, alignment and the reminders on their own seat; reminders they put on
 * other players stay behind with those players (Two Towns rules, linked above). The
 * caller adds the seat first (`AddSeat` with the player's name) and removes the old one
 * after.
 */
export function moveIntoTown(seat: Seat, newSeatId: SeatId): Command[] {
	if (seat.characterId === undefined) return [];
	const assign: Command = {
		type: 'AssignCharacter',
		seatId: newSeatId,
		characterId: seat.characterId
	};
	if (seat.alignment !== undefined) assign.alignment = seat.alignment;
	return [
		assign,
		...seat.reminders.map((r): Command => ({
			type: 'AddReminder',
			seatId: newSeatId,
			reminder: { characterId: r.characterId, label: r.label }
		}))
	];
}

/**
 * One token for both games (Two games at once, Trevor 2026-10-18: "the same one token will
 * account for both pulls"): the pair's tile in each town's bag. `state` is the pair's as one
 * token: drawn once both halves are confirmed, held while a seat has either.
 */
export interface TilePair {
	/** 1-based number shown on the token. */
	number: number;
	tiles: [TileId, TileId];
	state: 'in-bag' | 'held' | 'drawn';
	/** The seat index (seating order) that holds or drew the pair. */
	seat?: number;
}

/**
 * Pairs two towns' bags tile for tile. Both bags must hold the same number of tiles, else
 * undefined (a pull would have nothing to pair with). Tiles pair in tile-id order, which is
 * random, so a pair says nothing about either character; a pair that would give one player
 * a type the mode keeps to one town (the Demon in both) swaps its second half with the first
 * later pair where neither half has that type. Bags don't change during the draw, so the
 * pairs stay put.
 */
export function pairTiles(
	mode: GameMode,
	bags: readonly [Bag, Bag],
	games: readonly [Game, Game],
	typeOf: (id: CharacterId) => CharacterType | undefined
): TilePair[] | undefined {
	const [a, b] = bags.map((bag) => Object.keys(bag.tiles).sort());
	if (a.length !== b.length) return undefined;
	const kept = new Set<CharacterType>(mode.parts.towns?.notInEveryTown ?? []);
	const type = (bag: Bag, id: TileId) => typeOf(bag.tiles[id].grimoire);
	for (let i = 0; i < a.length; i++) {
		const clash = type(bags[0], a[i]);
		if (!clash || !kept.has(clash) || type(bags[1], b[i]) !== clash) continue;
		const j = b.findIndex(
			(id, k) => k > i && type(bags[1], id) !== clash && type(bags[0], a[k]) !== clash
		);
		if (j >= 0) [b[i], b[j]] = [b[j], b[i]];
	}
	return a.map((first, i) => {
		const tiles: [TileId, TileId] = [first, b[i]];
		const halves = tiles.map((id, town) => bags[town].tiles[id]);
		const seats = halves.map((tile, town) =>
			tile.drawnBySeat === undefined ? -1 : games[town].seating.indexOf(tile.drawnBySeat)
		);
		const seat = seats.find((s) => s >= 0);
		const state = halves.every((t) => t.confirmed)
			? 'drawn'
			: seat !== undefined
				? 'held'
				: 'in-bag';
		return { number: i + 1, tiles, state, ...(seat !== undefined ? { seat } : {}) };
	});
}

/**
 * The next seat (seating index) to draw a pair: the first with no character in either game
 * and no pair in hand.
 */
export function nextPairSeat(
	games: readonly [Game, Game],
	pairs: readonly TilePair[]
): number | undefined {
	const holding = new Set(pairs.filter((p) => p.state === 'held').map((p) => p.seat));
	const count = Math.min(games[0].seating.length, games[1].seating.length);
	for (let i = 0; i < count; i++) {
		if (holding.has(i)) continue;
		const free = games.every((g) => g.seats[g.seating[i]]?.characterId === undefined);
		if (free) return i;
	}
	return undefined;
}
