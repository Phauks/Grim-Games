/**
 * The reducers for ghost votes and vote tokens, one for each event type (`reducer.ts` looks them
 * up).
 */
import { updateSeat, type Reducers } from '#lib/core/engine/reduce/shared.ts';

export const VOTES_REDUCERS: Reducers<'GhostVoteSpent' | 'GhostVoteRestored' | 'VoteTokensSet'> = {
	GhostVoteSpent(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({ ...seat, ghostVoteUsed: true }));
	},
	GhostVoteRestored(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({ ...seat, ghostVoteUsed: false }));
	},
	VoteTokensSet(game, event) {
		return updateSeat(game, event.seatId, (seat) => {
			const next = { ...seat };
			if (event.count > 0) next.voteTokens = event.count;
			else delete next.voteTokens;
			return next;
		});
	}
};
