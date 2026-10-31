/**
 * How many votes put a nominee on the block: at least half the living players, rounded up;
 * a later nominee also needs more votes than the player already on the block (a tie means
 * nobody is on it). Paraphrased from https://wiki.bloodontheclocktower.com/Rules_Explanation
 * and the Glossary ("Execution"). Dead players' ghost votes count towards the total, but the
 * threshold uses only the living. The app does not track votes; this is the number to read
 * out.
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, inPlay, registersAsDead } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { afterDeath } from './nominations.ts';

export interface BlockThreshold {
	/** Living players (Travellers included). */
	alive: number;
	/** Votes needed to put a nominee on the block, with nobody on it yet. */
	needed: number;
}

export function blockThreshold(full: Game): BlockThreshold {
	const game = inPlay(full);
	const alive = game.seating.filter((s) => !game.seats[s].dead).length;
	return { alive, needed: neededToBlock(alive) };
}

/** Votes needed to put the first nominee on the block: half the living, rounded up. */
function neededToBlock(alive: number): number {
	return Math.ceil(alive / 2);
}

/**
 * Players who must support an exile, for the Storyteller, while a living Traveller is in play
 * (`neededToExile` over every seat), or undefined when nobody can be exiled.
 */
export function exileThreshold(full: Game, characters: CharacterLookup): number | undefined {
	const game = inPlay(full);
	const traveller = game.seating.some((s) => {
		const seat = game.seats[s];
		return (
			!seat.dead && !!seat.characterId && characters.get(seat.characterId)?.type === 'traveller'
		);
	});
	return traveller ? neededToExile(game.seating.length) : undefined;
}

/**
 * A seat as players' phones see it (`PublicSeat`): dead as the town sees it, with the ghost
 * vote it has or has spent, or the votes it casts with no token.
 */
export interface TownSeat {
	dead: boolean;
	ghostVote?: 'unused' | 'used';
	votes?: number;
	/** The Traveller in this seat, when the town knows it. */
	traveller?: string;
	/** At the table but not in play yet: left out of every count. */
	notInPlay?: true;
}

/** The day's counts as players' phones show them: the Storyteller's, without the teams. */
export interface TownCounts extends BlockThreshold {
	/** Every seat, dead ones included, for "7/8". */
	total: number;
	ghostVotes: number;
	/** Players who must support an exile, while the town knows a living Traveller is in play. */
	exile?: number;
}

/**
 * The Storyteller's alive count, votes to put a nominee on the block and ghost votes left
 * (`blockThreshold`, `ghostVotesLeft`), worked out the same way from what the town sees
 * (Trevor, 2026-10-27: "should calculate the same way as the information the storyteller
 * would already have access to"). The town's view is all a phone has, so a player who only
 * seems dead counts as dead here.
 */
export function townCounts(all: readonly TownSeat[]): TownCounts {
	const seats = all.filter((s) => !s.notInPlay);
	const alive = seats.filter((s) => !s.dead).length;
	const ghostVotes = seats.reduce(
		(sum, s) => sum + (s.dead ? (s.votes ?? (s.ghostVote === 'used' ? 0 : 1)) : 0),
		0
	);
	const counts: TownCounts = {
		alive,
		total: seats.length,
		needed: neededToBlock(alive),
		ghostVotes
	};
	if (seats.some((s) => s.traveller && !s.dead)) counts.exile = neededToExile(seats.length);
	return counts;
}

/**
 * Players who must support exiling a Traveller: at least half of every player, alive or dead,
 * Travellers included, rounded up. Anyone may support an exile, dead players without a vote
 * token too, and it is not a vote, so ghost votes are not spent (wiki Glossary, "Exile" and
 * "Player"; the Voudon page's example, where 5 of 12 supporting is not enough).
 */
export function neededToExile(players: number): number {
	return Math.ceil(players / 2);
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
		// Not in play yet: not living in the game (`Seat.notInPlay`).
		if (game.seats[seatId].dead || game.seats[seatId].notInPlay) continue;
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
 * (https://wiki.bloodontheclocktower.com/Dead_Player); one who votes without a token
 * (`votesWithoutToken`) adds their votes on a nomination.
 */
export function ghostVotesLeft(game: Game, characters: CharacterLookup): number {
	return seatsBehind(game, 'ghostVotes').reduce(
		(sum, seatId) => sum + counts(game, 'ghostVotes', seatId, characters),
		0
	);
}

/**
 * A dead player's votes on each nomination that need no vote token (`afterDeath`, the Banshee
 * killed by the Demon votes twice: https://wiki.bloodontheclocktower.com/Banshee), or
 * undefined when they vote with their one ghost vote, as the dead do.
 */
export function votesWithoutToken(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): number | undefined {
	return afterDeath(game, seatId, characters)?.votes;
}

/**
 * `votesWithoutToken` as the town knows it: the Banshee's death to the Demon is announced to
 * everyone (https://wiki.bloodontheclocktower.com/Banshee), so the players' grim shows it, but
 * only once the cause is recorded. A death with no recorded cause still shows a ghost vote, so
 * a dead player's character is never told to the town by guesswork.
 */
export function publicVotesWithoutToken(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): number | undefined {
	if (game.seats[seatId]?.deathCause === undefined) return undefined;
	return votesWithoutToken(game, seatId, characters);
}

/** A day count the Storyteller can open to see how it was worked out (Trevor, 2026-10-19). */
export type DayCount = 'alive' | 'good' | 'evil' | 'ghostVotes';

/**
 * The seats behind a day count, in seat order: every seat for `alive` (dead ones included,
 * so "7/8" shows who is missing), the living on a team for `good` and `evil`, and everyone
 * who registers as dead for `ghostVotes` (spent votes included). Each count above is the
 * sum of what `counts` gives these seats.
 */
export function seatsBehind(game: Game, count: DayCount): SeatId[] {
	return game.seating.filter((s) => {
		if (count === 'alive') return true;
		if (count === 'ghostVotes') return registersAsDead(game, s);
		return !game.seats[s].dead && alignmentOf(game, s) === count;
	});
}

/** What a seat from `seatsBehind` adds to the count: 0, 1, or a token-free voter's votes. */
export function counts(
	game: Game,
	count: DayCount,
	seatId: SeatId,
	characters: CharacterLookup
): number {
	if (count === 'alive') return game.seats[seatId].dead ? 0 : 1;
	if (count === 'ghostVotes')
		return (
			votesWithoutToken(game, seatId, characters) ?? (game.seats[seatId].ghostVoteUsed ? 0 : 1)
		);
	return 1;
}
