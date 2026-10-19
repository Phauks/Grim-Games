/**
 * How many votes put a nominee on the block: at least half the living players, rounded up;
 * a later nominee also needs more votes than the player already on the block (a tie means
 * nobody is on it). Paraphrased from https://wiki.bloodontheclocktower.com/Rules_Explanation
 * and the Glossary ("Execution"). Dead players' ghost votes count towards the total, but the
 * threshold uses only the living. The app does not track votes; this is the number to read
 * out.
 */
import { alignmentOf, registersAsDead } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

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

/**
 * Ghost votes still to use (Trevor, 2026-10-17): players who register as dead and have not
 * spent theirs. A dead player keeps one vote for the rest of the game
 * (https://wiki.bloodontheclocktower.com/Dead_Player).
 */
export function ghostVotesLeft(game: Game): number {
	return game.seating.filter((s) => registersAsDead(game, s) && !game.seats[s].ghostVoteUsed)
		.length;
}

/** A day count the Storyteller can open to see how it was worked out (Trevor, 2026-10-19). */
export type DayCount = 'alive' | 'good' | 'evil' | 'ghostVotes';

/**
 * The seats behind a day count, in seat order: every seat for `alive` (dead ones included,
 * so "7/8" shows who is missing), the living on a team for `good` and `evil`, and everyone
 * who registers as dead for `ghostVotes` (spent votes included). Each count above is the
 * number of these seats that `counts` says yes to.
 */
export function seatsBehind(game: Game, count: DayCount): SeatId[] {
	return game.seating.filter((s) => {
		if (count === 'alive') return true;
		if (count === 'ghostVotes') return registersAsDead(game, s);
		return !game.seats[s].dead && alignmentOf(game, s) === count;
	});
}

/** Whether a seat from `seatsBehind` adds one to the count. */
export function counts(game: Game, count: DayCount, seatId: SeatId): boolean {
	if (count === 'alive') return !game.seats[seatId].dead;
	if (count === 'ghostVotes') return !game.seats[seatId].ghostVoteUsed;
	return true;
}
