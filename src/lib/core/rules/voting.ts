/**
 * How many votes put a nominee on the block: at least half the living players, rounded up;
 * a later nominee also needs more votes than the player already on the block (a tie means
 * nobody is on it). Paraphrased from https://wiki.bloodontheclocktower.com/Rules_Explanation
 * and the Glossary ("Execution"). Dead players' ghost votes count towards the total, but the
 * threshold uses only the living. The app does not track votes; this is the number to read
 * out.
 */
import { alignmentOf } from '#lib/core/model/selectors.ts';
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

/** Living players by team, for the Storyteller (Trevor, 2026-10-17). */
export interface LivingByTeam {
	alive: number;
	good: number;
	evil: number;
	/** Alive with no alignment yet (a Traveller before the Storyteller sets it). */
	unknown: number;
}

/** Living players on each team, by the alignment the rules use (overrides win). */
export function livingByTeam(game: Game): LivingByTeam {
	const out: LivingByTeam = { alive: 0, good: 0, evil: 0, unknown: 0 };
	for (const seatId of game.seating) {
		if (game.seats[seatId].dead) continue;
		out.alive++;
		const alignment = alignmentOf(game, seatId);
		if (alignment) out[alignment]++;
		else out.unknown++;
	}
	return out;
}
