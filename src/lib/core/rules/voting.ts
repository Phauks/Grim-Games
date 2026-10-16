/**
 * How many votes put a nominee on the block: at least half the living players, rounded up;
 * a later nominee also needs more votes than the player already on the block (a tie means
 * nobody is on it). Paraphrased from https://wiki.bloodontheclocktower.com/Rules_Explanation
 * and the Glossary ("Execution"). Dead players' ghost votes count towards the total, but the
 * threshold uses only the living. The app does not track votes; this is the number to read
 * out.
 */
import type { Game } from '#lib/core/model/types.ts';

export interface BlockThreshold {
	/** Living players (Travellers included). */
	alive: number;
	/** Votes needed to put a nominee on the block, with nobody on it yet. */
	needed: number;
}

export function blockThreshold(game: Game): BlockThreshold {
	const alive = game.seating.filter((s) => !game.seats[s].dead).length;
	return { alive, needed: Math.ceil(alive / 2) };
}
