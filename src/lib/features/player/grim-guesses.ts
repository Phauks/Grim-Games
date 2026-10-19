/**
 * What a player thinks each seat is, on their own Grim tab (Trevor, 2026-10-19: "players can
 * tap a player and put what they think they are as a character"). Kept on this phone only,
 * per room; seat ids are new in every game, so a new game starts with no guesses.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

/** Seat id to the character this player thinks sits there. */
export type Guesses = Record<string, CharacterId>;

/** A room holds at most this many players, so older guesses beyond it are dropped. */
const MAX_GUESSES = 40;

const key = (room: string) => `grim-games:play:guesses:${room}`;

export function parseGuesses(raw: unknown): Guesses {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const entries = Object.entries(raw).filter(
		(e): e is [string, CharacterId] => typeof e[1] === 'string' && e[1] !== ''
	);
	return Object.fromEntries(entries.slice(-MAX_GUESSES));
}

/** The guesses with `seatId` set to `characterId`, or cleared when there is none. */
export function withGuess(guesses: Guesses, seatId: string, characterId?: CharacterId): Guesses {
	const { [seatId]: _old, ...rest } = guesses;
	void _old;
	return parseGuesses(characterId ? { ...rest, [seatId]: characterId } : rest);
}

export function readGuesses(room: string): Guesses {
	return parseGuesses(readStored(key(room)));
}

export function writeGuesses(room: string, guesses: Guesses): void {
	writeStored(key(room), guesses);
}
