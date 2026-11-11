/**
 * Which players a character turns into characters of another type: the `turnsPlayersInto`
 * part (`parts/turns-players-into.ts`) and a jinx's `alsoBecomes` (`jinx-read.ts`) share these.
 */
import { SEATED_TYPES, type SeatedType } from './types.ts';
import { readEnum, type Issues, type Json } from './validate.ts';

/**
 * Which players:
 * - `chosen`: as many as the setup counts give that type, picked by the character (the Kazali's
 *   Minions, https://wiki.bloodontheclocktower.com/Kazali);
 * - `neighbours`: its two neighbours, so the evil players sit in a line with it in the middle
 *   (the Lord of Typhon's Minions, https://wiki.bloodontheclocktower.com/Lord_of_Typhon);
 * - `drafter`: the player who drafts it, as the character itself is not dealt (Lil' Monsta's
 *   Minions, https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 */
export const TURNS_PLAYERS = ['chosen', 'neighbours', 'drafter'] as const;
export type TurnsPlayers = (typeof TURNS_PLAYERS)[number];

/**
 * Reads `type` and `players` from the object `raw` at `path`, `players` one of `allowed` and
 * `fallback` when left out (a jinx's `alsoBecomes` reads this too, P12). Other keys are the
 * caller's to check.
 */
export function readPlayersOfType<P extends TurnsPlayers>(
	raw: Json,
	path: string,
	issues: Issues,
	allowed: readonly P[],
	fallback?: P
): { type: SeatedType; players: P } | undefined {
	const type = readEnum(raw, 'type', SEATED_TYPES, path, issues, true);
	const players =
		readEnum(raw, 'players', allowed, path, issues, fallback === undefined) ??
		(raw.players === undefined ? fallback : undefined);
	return type && players ? { type, players } : undefined;
}
