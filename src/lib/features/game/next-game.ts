import type { Game, GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

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
	/** When the sheet opened; a carry left behind by a closed tab goes stale. */
	at: number;
}

const KEY = 'grim-games:next-game:v1';
/** A carry older than this is ignored, so a crash never seats them in a later game. */
const STALE_MS = 60 * 60 * 1000;

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
	writeStored(KEY, next);
}

export function clearNextGame(): void {
	writeStored(KEY, undefined);
}

/** The carry, if a fresh one is set; read leniently. */
export function readNextGame(now = Date.now()): NextGame | undefined {
	const raw = readStored(KEY);
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	if (typeof r.from !== 'string' || typeof r.at !== 'number' || now - r.at > STALE_MS)
		return undefined;
	const names = Array.isArray(r.names)
		? r.names.map((n) => (typeof n === 'string' && n.trim() ? n : undefined))
		: [];
	return { from: r.from as GameId, drop: r.drop === true, names, at: r.at };
}

/** Reads the carry and clears it, so only one game takes it. */
export function takeNextGame(now = Date.now()): NextGame | undefined {
	const next = readNextGame(now);
	if (next) clearNextGame();
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
