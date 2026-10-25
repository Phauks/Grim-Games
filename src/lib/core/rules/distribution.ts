/**
 * The standard character distribution: how many Townsfolk, Outsiders, Minions and Demons
 * for 5 to 15 players, and Travellers for everyone beyond 15.
 *
 * https://wiki.bloodontheclocktower.com/Setup says to use the counts on the setup sheet
 * (the wiki does not print the table as text) and that players beyond fifteen join as
 * Travellers. The counts below are the ones on the physical setup sheet and the Traveller
 * sheet (02-game-rules-primer.md §2). They follow a pattern: one more Minion every three
 * players from 10, and Outsiders cycling 0, 1, 2 within each band of three.
 */

import { SEATED_TYPES, type SeatedType } from '#lib/core/data/types.ts';

export { SEATED_TYPES, type SeatedType };
export type TypeCounts = Record<SeatedType, number>;

export const MIN_PLAYERS = 5;
/** Above this, extra players join as Travellers. */
export const MAX_DEALT_PLAYERS = 15;

/** Indexed by player count, 5 to 15. */
export const BASE_DISTRIBUTION: Readonly<Record<number, Readonly<TypeCounts>>> = {
	5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
	6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
	7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
	8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
	9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
	10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
	11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
	12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
	13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
	14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
	15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 }
};

export interface PlayerSplit {
	/** Players who take a character from the bag. */
	dealt: number;
	/** Players who join as Travellers. */
	travellers: number;
	counts: TypeCounts;
	warnings: string[];
}

/**
 * Splits `players` into dealt players and Travellers and gives the standard counts.
 * `travellers` defaults to everyone beyond 15; pass it when players chose to travel in a
 * smaller game. Never throws: odd inputs give a best-effort answer and a warning.
 */
export function splitPlayers(players: number, travellers?: number): PlayerSplit {
	const warnings: string[] = [];
	const total = Math.max(0, Math.floor(players));
	let extra = travellers ?? Math.max(0, total - MAX_DEALT_PLAYERS);
	extra = Math.min(Math.max(0, Math.floor(extra)), total);
	const dealt = total - extra;
	if (dealt > MAX_DEALT_PLAYERS) {
		warnings.push(
			`${dealt} players are taking characters from the bag; the setup sheet stops at 15, so the extra players are usually Travellers.`
		);
	}
	if (dealt < MIN_PLAYERS) {
		warnings.push(
			`Blood on the Clocktower needs at least ${MIN_PLAYERS} players who are not Travellers; ${dealt} ${dealt === 1 ? 'is' : 'are'} not enough for a standard game.`
		);
	}
	return { dealt, travellers: extra, counts: { ...baseCounts(dealt) }, warnings };
}

/** Standard counts for `dealt` players; outside 5–15, the nearest sensible counts. */
export function baseCounts(dealt: number): TypeCounts {
	if (dealt >= MIN_PLAYERS && dealt <= MAX_DEALT_PLAYERS) return { ...BASE_DISTRIBUTION[dealt] };
	if (dealt > MAX_DEALT_PLAYERS) {
		const top = BASE_DISTRIBUTION[MAX_DEALT_PLAYERS];
		return { ...top, townsfolk: top.townsfolk + dealt - MAX_DEALT_PLAYERS };
	}
	// Fewer than 5: one Demon, one Minion if there is room, the rest Townsfolk.
	const demon = dealt > 0 ? 1 : 0;
	const minion = dealt > 2 ? 1 : 0;
	return { townsfolk: Math.max(0, dealt - demon - minion), outsider: 0, minion, demon };
}
