/**
 * A contest that ends the game (`gameEnd.contest`): a player of the rule's `chooser` type picks
 * a player of the other alignment, everyone votes for one of the two, and the one with the most
 * votes wins for their team, `tie` winning a tie. The Fiddler's fiddle contest: the Demon
 * chooses a good player (an evil one if the Demon is good), and evil wins a tie
 * (https://wiki.bloodontheclocktower.com/Fiddler). Votes are counted outside the app (Trevor,
 * 2026-11-01); the Storyteller enters the two totals.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/** The contest rule of `characterId`, if its ability holds one. */
function contestRule(characterId: CharacterId, characters?: CharacterLookup) {
	return rulesOf(characterId, characters)?.gameEnd?.contest;
}

/**
 * The players `chooser` may pick for the contest: every player of the other alignment, in
 * seating order. None while the chooser's alignment is not set.
 */
export function contestOpponents(
	game: Game,
	characterId: CharacterId,
	chooser: SeatId,
	characters: CharacterLookup
): SeatId[] {
	if (!contestRule(characterId, characters)) return [];
	const own = alignmentOf(game, chooser);
	if (own === undefined) return [];
	return game.seating.filter((id) => {
		const theirs = alignmentOf(game, id);
		return id !== chooser && theirs !== undefined && theirs !== own;
	});
}

/**
 * The team that wins the contest between `a` and `b`, given each one's votes: the team of the
 * player with more, or the rule's `tie` team on a tie. Undefined without a contest rule or
 * while either player's alignment is not set.
 */
export function contestWinner(
	game: Game,
	characterId: CharacterId,
	a: { seatId: SeatId; votes: number },
	b: { seatId: SeatId; votes: number },
	characters: CharacterLookup
): Alignment | undefined {
	const rule = contestRule(characterId, characters);
	if (!rule) return undefined;
	if (a.votes === b.votes) return rule.tie;
	return alignmentOf(game, a.votes > b.votes ? a.seatId : b.seatId);
}
