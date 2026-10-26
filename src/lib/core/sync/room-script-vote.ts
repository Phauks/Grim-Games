/**
 * The room's vote on the next script or game mode (plan R1), as the live room runs it: opening,
 * ballots, the count, and ending it. Kept apart from `room.ts` so each stays a readable size.
 */
import {
	cleanBallot,
	endScriptVoteSoon,
	newScriptVote,
	scriptVoteEnded,
	tallyScriptVote,
	type ScriptVoteTally
} from './script-vote.ts';
import type { RoomState } from './room.ts';

/**
 * The script vote's count over members here now, or who have voted anyway, with who they
 * are and whether each has voted.
 */
export function scriptVoteCount(room: RoomState, present?: ReadonlySet<string>): ScriptVoteTally {
	const vote = room.scriptVote!;
	const counted = room.members.filter(
		(m) => !present || present.has(m.memberId) || !!vote.ballots[m.memberId]
	);
	return {
		...tallyScriptVote(
			vote,
			counted.map((m) => m.memberId)
		),
		people: counted.map((m) => ({
			...(m.name ? { name: m.name } : {}),
			voted: !!vote.ballots[m.memberId]
		}))
	};
}

/** Opens a vote on the next script, replacing any open one; a malformed one changes nothing. */
export function openScriptVote(
	room: RoomState,
	voteId: unknown,
	kind: unknown,
	options: unknown,
	minutes?: unknown,
	now = 0,
	subject?: unknown,
	showTally?: unknown
): RoomState {
	const vote = newScriptVote(voteId, kind, options, minutes, now, subject, showTally);
	return vote ? { ...room, scriptVote: vote } : room;
}

/** Lets players see the open script vote's count, or stops it (Trevor, 2026-10-26). */
export function showScriptVoteTally(room: RoomState, show: unknown): RoomState {
	const vote = room.scriptVote;
	if (!vote || typeof show !== 'boolean' || show === !!vote.showTally) return room;
	const { showTally: _shown, ...rest } = vote;
	void _shown;
	return { ...room, scriptVote: show ? { ...rest, showTally: true } : rest };
}

/** Ends the open script vote after a final call (endScriptVoteSoon). */
export function endScriptVote(room: RoomState, now: number): RoomState {
	if (!room.scriptVote) return room;
	const vote = endScriptVoteSoon(room.scriptVote, now);
	return vote === room.scriptVote ? room : { ...room, scriptVote: vote };
}

export function closeScriptVote(room: RoomState): RoomState {
	if (!room.scriptVote) return room;
	const { scriptVote: _closed, ...rest } = room;
	void _closed;
	return rest;
}

/**
 * A member's ballot in the open script vote; an empty one withdraws their vote (Trevor,
 * 2026-10-26: "back out"). A stale or malformed one, or one after the time limit ran out at
 * `now`, is ignored.
 */
export function castScriptBallot(
	room: RoomState,
	memberId: string,
	voteId: unknown,
	choices: unknown,
	now = 0
): RoomState {
	const vote = room.scriptVote;
	if (!vote || voteId !== vote.voteId || !room.members.some((m) => m.memberId === memberId)) {
		return room;
	}
	if (scriptVoteEnded(vote, now)) return room;
	if (Array.isArray(choices) && choices.length === 0) {
		if (!vote.ballots[memberId]) return room;
		const { [memberId]: _withdrawn, ...ballots } = vote.ballots;
		void _withdrawn;
		return { ...room, scriptVote: { ...vote, ballots } };
	}
	const ballot = cleanBallot(vote, choices);
	if (!ballot) return room;
	return { ...room, scriptVote: { ...vote, ballots: { ...vote.ballots, [memberId]: ballot } } };
}
