/**
 * Whether the day's Execution has more to ask than "Execute them?" (Trevor, 2026-11-06: the
 * executed player is tapped on the board and confirmed there, option B): a save that can stop
 * the death (Saved by, an ability in play only, Trevor 2026-11-06), a player who may be executed instead, an ability that changes the
 * execution, or a player who may still nominate after it. Then the Execution sheet opens with
 * the player chosen; otherwise the board's own Confirm is enough.
 */
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import { insteadCandidates } from './executed-instead.ts';
import { outcomeHolders } from './execution-outcome.ts';
import { extraNominators } from './nominations.ts';
import { executionSavers, protection } from './protection.ts';

/** True when executing `seatId` has a choice for the Execution sheet to show. */
export function executionAsks(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return (
		executionSavers(game, seatId, characters).some((s) => s.problem !== 'not-in-play') ||
		protection(game, seatId, characters, 'execution') === 'override' ||
		insteadCandidates(game, characters).length > 0 ||
		outcomeHolders(game, characters).some((holder) => holder.works) ||
		extraNominators(game, characters).length > 0
	);
}
