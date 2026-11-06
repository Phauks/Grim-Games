/**
 * Players a character turns into characters of another type at setup: the `turnsPlayersInto`
 * part of its rules block, read here and worked out in `modes/draft.ts` (Sushi Buffet). It names
 * a behaviour and its type, never a character.
 */
import { SEATED_TYPES, type SeatedType } from './types.ts';
import { checkKeys, describe, isObject, readEnum, type Issues, type Json } from './validate.ts';

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

export interface TurnsPlayersInto {
	type: SeatedType;
	players: TurnsPlayers;
}

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

/** Reads `raw`, the `turnsPlayersInto` of the rules block at `path`; left out, undefined. */
export function readTurnsPlayersInto(
	raw: unknown,
	path: string,
	issues: Issues
): TurnsPlayersInto | undefined {
	if (raw === undefined) return undefined;
	path = `${path}.turnsPlayersInto`;
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['type', 'players'], path, issues);
	return readPlayersOfType(raw, path, issues, TURNS_PLAYERS);
}
