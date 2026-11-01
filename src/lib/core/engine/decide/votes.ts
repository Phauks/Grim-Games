/**
 * Votes on a logged nomination (M9a): who raised their hand, the ghost votes and vote tokens
 * that spends, and the warnings for a vote the rules forbid. It never refuses one: the
 * Storyteller tallies an illegal vote anyway and has a private word later
 * (https://wiki.bloodontheclocktower.com/Butler, How to Run).
 */
import { getSeat, registersAsDead } from '#lib/core/model/selectors.ts';
import type { Game, NominationVotes, SeatId } from '#lib/core/model/types.ts';
import { carriersOf, mustVoteNow, voterRule, votesWithoutToken } from '#lib/core/rules/index.ts';
import type { GameEvent } from '../events.ts';
import { entryOfKind, refuse, seatOf, type Deciders } from './shared.ts';

/** The events that give back what a vote record spent: its ghost votes and vote tokens. */
export function releaseVotes(game: Game, votes: NominationVotes | undefined): GameEvent[] {
	if (!votes) return [];
	const events: GameEvent[] = [];
	for (const seatId of votes.ghostVotes ?? []) {
		if (getSeat(game, seatId)?.ghostVoteUsed) events.push({ type: 'GhostVoteRestored', seatId });
	}
	for (const seatId of votes.tokens ?? []) {
		const seat = getSeat(game, seatId);
		if (seat) events.push({ type: 'VoteTokensSet', seatId, count: (seat.voteTokens ?? 0) + 1 });
	}
	return events;
}

export const VOTES_DECIDERS: Deciders<'RecordVotes' | 'GiveVoteToken'> = {
	RecordVotes(game, command, ctx, warn) {
		const entry = entryOfKind(game, command.entryId, 'nomination');
		const old = entry.votes;
		if (command.voters === undefined) {
			if (!old) {
				warn('no-change', 'no votes are recorded');
				return [];
			}
			const next: typeof entry = { ...entry };
			delete next.votes;
			return [...releaseVotes(game, old), { type: 'DayEntryReplaced', entry: next }];
		}
		const picked = new Set(command.voters.map((s) => seatOf(game, s).seatId));
		const voters = game.seating.filter((s) => picked.has(s));
		if (old && JSON.stringify(old.voters) === JSON.stringify(voters)) {
			warn('no-change', 'the votes are unchanged');
			return [];
		}
		const { characters } = ctx;
		// What the old record spent and still applies stays spent; the rest comes back.
		const keep = (list: SeatId[] | undefined) => (list ?? []).filter((s) => picked.has(s));
		const ghostVotes = keep(old?.ghostVotes);
		const tokens = keep(old?.tokens);
		const events: GameEvent[] = releaseVotes(game, {
			voters: [],
			ghostVotes: (old?.ghostVotes ?? []).filter((s) => !picked.has(s)),
			tokens: (old?.tokens ?? []).filter((s) => !picked.has(s))
		});
		const tokensLeft = new Map<SeatId, number>();
		for (const e of events) if (e.type === 'VoteTokensSet') tokensLeft.set(e.seatId, e.count);

		for (const seatId of voters) {
			const seat = game.seats[seatId];
			if (seat.notInPlay) warn('not-in-play', 'a voter is not in play yet');
			const voter = voterRule(game, seatId, characters);
			if (voter?.rule.onlyWith) {
				const masters = carriersOf(game, voter.characterId, voter.rule.onlyWith);
				if (!masters.some((m) => picked.has(m)))
					warn('only-votes-with', 'a voter may only vote with another player', [voter.characterId]);
			}
			const dead = registersAsDead(game, seatId);
			if (dead) {
				if (votesWithoutToken(game, seatId, characters) !== undefined) continue;
				if (ghostVotes.includes(seatId)) continue;
				if (seat.ghostVoteUsed) {
					warn('no-ghost-vote', 'a dead voter has already used their ghost vote');
					continue;
				}
				ghostVotes.push(seatId);
				events.push({ type: 'GhostVoteSpent', seatId });
			} else if (voter?.rule.needsToken && !tokens.includes(seatId)) {
				const held = tokensLeft.get(seatId) ?? seat.voteTokens ?? 0;
				if (held < 1) {
					warn('no-vote-token', 'a voter needs a vote token to vote', [voter.characterId]);
					continue;
				}
				tokens.push(seatId);
				events.push({ type: 'VoteTokensSet', seatId, count: held - 1 });
			}
		}
		for (const seatId of game.seating) {
			if (picked.has(seatId) || game.seats[seatId].notInPlay) continue;
			const voter = voterRule(game, seatId, characters);
			if (voter && mustVoteNow(game, voter.rule))
				warn('must-vote', 'a player who must vote did not', [voter.characterId]);
		}

		const votes: NominationVotes = { voters };
		const inOrder = (list: SeatId[]) => game.seating.filter((s) => list.includes(s));
		if (ghostVotes.length > 0) votes.ghostVotes = inOrder(ghostVotes);
		if (tokens.length > 0) votes.tokens = inOrder(tokens);
		return [...events, { type: 'DayEntryReplaced', entry: { ...entry, votes } }];
	},

	GiveVoteToken(game, command, ctx, warn) {
		const from = seatOf(game, command.from);
		const to = seatOf(game, command.to);
		if (from.seatId === to.seatId) refuse('same-seat', 'a player cannot give themself a token');
		if (!registersAsDead(game, from.seatId)) {
			warn('giver-not-dead', 'only a dead player gives their vote token');
		}
		if (!voterRule(game, to.seatId, ctx.characters)?.rule.needsToken) {
			warn('needs-no-token', 'vote tokens are only given to a player who needs one to vote');
		}
		const events: GameEvent[] = [];
		if (from.ghostVoteUsed) warn('no-ghost-vote', 'the giver has already used their ghost vote');
		else events.push({ type: 'GhostVoteSpent', seatId: from.seatId });
		events.push({ type: 'VoteTokensSet', seatId: to.seatId, count: (to.voteTokens ?? 0) + 1 });
		return events;
	}
};
