/**
 * Seats dealt a character that no one plays (a rule's `seats` part: The Ballad of Seat 7,
 * https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/). The Storyteller makes their
 * choices and may speak for them as the rule allows. Any seat, at any player count (Trevor,
 * 2026-11-12: "Can be any seat. Ballad of seat 7 could be used in any player count.").
 */
import type { DayEntry, Game, SeatId, SpokeHow } from '#lib/core/model/types.ts';
import type { SeatsRule } from './types.ts';

/**
 * The seats no one plays: the ones the Storyteller marked from the seat's ⋯ (`Seat.noPlayer`).
 * None without the rule.
 */
export function noPlayerSeats(game: Game, rule: SeatsRule | undefined): SeatId[] {
	if (rule?.kind !== 'storyteller-seat' || rule.count < 1) return [];
	return game.seating.filter((id) => game.seats[id]?.noPlayer);
}

/** Every time the Storyteller has spoken for a seat this game, oldest first. */
export function spokeFor(game: Game, seatId: SeatId): Extract<DayEntry, { kind: 'spoke' }>[] {
	return [...game.pastDays, game.today]
		.flatMap((day) => day.entries)
		.filter((e): e is Extract<DayEntry, { kind: 'spoke' }> => e.kind === 'spoke')
		.filter((e) => e.seatId === seatId);
}

/**
 * The ways the Storyteller may still speak for a seat under the rule: `once` for a single time
 * a game (the rule as written), `private` and `public` once each (A Terrifying Whisper). Empty
 * once they are used, or when the rule never lets them.
 */
export function speakingLeft(
	game: Game,
	seatId: SeatId,
	rule: SeatsRule | undefined
): ('once' | SpokeHow)[] {
	const used = spokeFor(game, seatId);
	switch (rule?.speaks) {
		case 'once-per-game':
			return used.length === 0 ? ['once'] : [];
		case 'private-and-public':
			return (['private', 'public'] as const).filter((how) => !used.some((e) => e.how === how));
		default:
			return [];
	}
}

/**
 * Whether the Storyteller may still add the seat's vote today under the rule (Seats Rise Up):
 * once a day, while it still has a vote (alive, or dead with its ghost vote).
 */
export function seatMayVote(game: Game, seatId: SeatId, rule: SeatsRule | undefined): boolean {
	if (rule?.kind !== 'storyteller-seat' || rule.votes !== 'once-per-day') return false;
	const seat = game.seats[seatId];
	if (!seat || (seat.dead && seat.ghostVoteUsed)) return false;
	return !game.today.entries.some((e) => e.kind === 'seat-vote' && e.seatId === seatId);
}
