/**
 * Teensyville: scripts made for 5 or 6 players, whose sheet has six Townsfolk, two
 * Outsiders, two Minions and two Demons (https://wiki.bloodontheclocktower.com/Teensyville).
 * The deal itself still follows the setup sheet for 5 or 6 players (`distribution.ts`).
 *
 * The related 7+ player rule: Minion info and Demon info are only first-night steps with 7
 * or more players (https://wiki.bloodontheclocktower.com/Glossary, "Minion Info" and
 * "Demon Info"), unless the Toymaker restores them
 * (https://wiki.bloodontheclocktower.com/Toymaker).
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { TypeCounts } from './distribution.ts';
import { SEATED_TYPES } from './distribution.ts';

export const TEENSYVILLE_SHEET: Readonly<TypeCounts> = {
	townsfolk: 6,
	outsider: 2,
	minion: 2,
	demon: 2
};
export const TEENSYVILLE_MAX_PLAYERS = 6;
/** Minion info and Demon info need at least this many players. */
export const EVIL_INFO_MIN_PLAYERS = 7;

/** Counts of a script's dealt characters by type. */
export function sheetCounts(characters: readonly Character[]): TypeCounts {
	const counts: TypeCounts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
	for (const c of characters) {
		if ((SEATED_TYPES as readonly string[]).includes(c.type)) counts[c.type as keyof TypeCounts]++;
	}
	return counts;
}

/** True when the script has exactly the Teensyville sheet: 6 / 2 / 2 / 2. */
export function isTeensyvilleScript(characters: readonly Character[]): boolean {
	const counts = sheetCounts(characters);
	return SEATED_TYPES.every((t) => counts[t] === TEENSYVILLE_SHEET[t]);
}

/** Advice for playing a script at a player count (never blocks). */
export function teensyvilleWarnings(characters: readonly Character[], players: number): string[] {
	const warnings: string[] = [];
	if (isTeensyvilleScript(characters) && players > TEENSYVILLE_MAX_PLAYERS) {
		warnings.push(
			`This is a Teensyville script, made for 5 or 6 players; with ${players} players there may not be enough characters.`
		);
	}
	return warnings;
}

/**
 * Whether the first night has the Minion info and Demon info steps: 7 or more players, or
 * the Toymaker in play ("evil players get normal starting info").
 */
export function hasEvilTeamInfo(players: number, inPlay: Iterable<CharacterId>): boolean {
	if (players >= EVIL_INFO_MIN_PLAYERS) return true;
	for (const id of inPlay) if (id === 'toymaker') return true;
	return false;
}
