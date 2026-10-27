/**
 * What the Storyteller played from the room vote's screen, for New game to choose when it
 * opens next (Trevor, 2026-10-26: the vote is its own screen). Kept in memory only: it is
 * taken once, straight after the vote screen goes to New game. Special rules stack, so a vote
 * on them plays every rule the Storyteller keeps.
 */
export type VotePick =
	{ subject: 'script' | 'mode'; id: string } | { subject: 'rules'; ids: string[] };

let pending: VotePick | undefined;

export function pickFromVote(pick: VotePick): void {
	pending = pick;
}

export function takeVotePick(): VotePick | undefined {
	const pick = pending;
	pending = undefined;
	return pick;
}
