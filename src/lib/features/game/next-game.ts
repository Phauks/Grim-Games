import type { Game, GameId } from '#lib/core/model/index.ts';
import { writeStored } from '#lib/ui/stored.ts';

/**
 * New game from inside a game (Game info, Trevor 2026-10-24: "a way to 'Start A New Game'"):
 * the players to seat in the next game, and the game it replaces. Set while Game info's New
 * game sheet is open; the next game created takes it (OpenGame.create), ending or dropping
 * the old one then, so closing the sheet changes nothing. Device-only.
 */
export interface NextGame {
	/** The game being replaced. */
	from: GameId;
	/** True when nothing of it happened yet: it is dropped, not kept in History. */
	drop: boolean;
	/** Player names in seating order; an unnamed seat is undefined. */
	names: (string | undefined)[];
	/** When the sheet opened. */
	at: number;
}

/** Where earlier builds kept the carry; removed so nothing reads a stale one. */
const OLD_KEY = 'grim-games:next-game:v1';
writeStored(OLD_KEY, undefined);

let carried: NextGame | undefined;

/** The players and game to carry from `game` into the next one. */
export function carryFrom(game: Game, drop: boolean, now = Date.now()): NextGame {
	return {
		from: game.gameId,
		drop,
		names: game.seating.map((id) => game.seats[id]?.playerName),
		at: now
	};
}

export function setNextGame(next: NextGame): void {
	carried = { ...next, names: [...next.names] };
}

export function clearNextGame(): void {
	carried = undefined;
}

/** The carry, while Game info's New game sheet is open. */
export function readNextGame(): NextGame | undefined {
	return carried;
}

/** Reads the carry and clears it, so only one game takes it. */
export function takeNextGame(): NextGame | undefined {
	const next = carried;
	carried = undefined;
	return next;
}

/** Games a New game from Game info has just replaced, so their board lets the new one open. */
const replaced = new Set<GameId>();

export function markReplaced(gameId: GameId): void {
	replaced.add(gameId);
}

/** True once a new game took this game's players: leaving its board then needs no question. */
export function wasReplaced(gameId: GameId): boolean {
	return replaced.has(gameId);
}
