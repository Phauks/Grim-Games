/**
 * Players a character turns into characters of another type at setup: the `turnsPlayersInto`
 * part of its rules block, read here and worked out in `modes/draft.ts` (Sushi Buffet). It names
 * a behaviour and its type, never a character.
 */
import { SEATED_TYPES, type SeatedType } from './types.ts';
import { checkKeys, describe, isObject, readEnum, type Issues } from './validate.ts';

/**
 * Which players:
 * - `chosen`: as many as the setup counts give that type, picked by the character (the Kazali's
 *   Minions, https://wiki.bloodontheclocktower.com/Kazali);
 * - `neighbours`: its two neighbours, so the evil players sit in a line with it in the middle
 *   (the Lord of Typhon's Minions, https://wiki.bloodontheclocktower.com/Lord_of_Typhon).
 */
export const TURNS_PLAYERS = ['chosen', 'neighbours'] as const;

export interface TurnsPlayersInto {
	type: SeatedType;
	players: (typeof TURNS_PLAYERS)[number];
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
	const type = readEnum(raw, 'type', SEATED_TYPES, path, issues, true);
	const players = readEnum(raw, 'players', TURNS_PLAYERS, path, issues, true);
	return type && players ? { type, players } : undefined;
}
