/**
 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
 * two or three scripts and players vote on their phones, by single choice, multiple choice
 * or ranking. The room only counts; the Storyteller reads the result and picks.
 */

/** How players vote: one script, any number of them, or all of them in order. */
export type ScriptVoteKind = 'single' | 'multiple' | 'ranked';

export const SCRIPT_VOTE_KINDS: readonly ScriptVoteKind[] = ['single', 'multiple', 'ranked'];

/** A script on offer: an id the Storyteller's device knows it by, and what phones show. */
export interface ScriptVoteOption {
	id: string;
	name: string;
	author?: string;
}

export const MIN_SCRIPT_VOTE_OPTIONS = 2;
export const MAX_SCRIPT_VOTE_OPTIONS = 3;
const MAX_ID = 200;
const MAX_TEXT = 120;

export interface ScriptVote {
	voteId: string;
	kind: ScriptVoteKind;
	options: ScriptVoteOption[];
	/** Each player's ballot, by member id: their choices, in order for a ranked vote. */
	ballots: Record<string, string[]>;
}

/** What the Storyteller's device sees of the vote: points per option, and who voted. */
export interface ScriptVoteTally {
	voteId: string;
	kind: ScriptVoteKind;
	options: ScriptVoteOption[];
	/**
	 * Per option id: votes for a single or multiple choice; for a ranked vote, points by
	 * position (first of three gets 3, then 2, then 1), so the highest is the town's pick.
	 */
	points: Record<string, number>;
	voted: number;
	members: number;
}

const text = (value: unknown) =>
	typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';

/** A vote from what the Storyteller sent; `undefined` when it isn't one. */
export function newScriptVote(
	voteId: unknown,
	kind: unknown,
	options: unknown
): ScriptVote | undefined {
	if (typeof voteId !== 'string' || !voteId || voteId.length > MAX_ID) return undefined;
	if (!SCRIPT_VOTE_KINDS.includes(kind as ScriptVoteKind) || !Array.isArray(options)) return;
	const seen = new Set<string>();
	const clean: ScriptVoteOption[] = [];
	for (const raw of options) {
		const { id, name, author } = (raw ?? {}) as Record<string, unknown>;
		if (typeof id !== 'string' || !id || id.length > MAX_ID || seen.has(id)) continue;
		const shown = text(name);
		if (!shown) continue;
		seen.add(id);
		const by = text(author);
		clean.push({ id, name: shown, ...(by ? { author: by } : {}) });
	}
	if (clean.length < MIN_SCRIPT_VOTE_OPTIONS || clean.length > MAX_SCRIPT_VOTE_OPTIONS) return;
	return { voteId, kind: kind as ScriptVoteKind, options: clean, ballots: {} };
}

/**
 * A player's ballot, checked against the vote: one choice for a single choice, at least one
 * for a multiple choice, every option once for a ranking. `undefined` when it doesn't fit.
 */
export function cleanBallot(vote: ScriptVote, choices: unknown): string[] | undefined {
	if (!Array.isArray(choices)) return undefined;
	const ids = new Set(vote.options.map((o) => o.id));
	if (!choices.every((c) => typeof c === 'string' && ids.has(c))) return undefined;
	const unique = [...new Set(choices as string[])];
	if (unique.length !== choices.length || unique.length === 0) return undefined;
	if (vote.kind === 'single' && unique.length !== 1) return undefined;
	if (vote.kind === 'ranked' && unique.length !== ids.size) return undefined;
	return unique;
}

export function tallyScriptVote(vote: ScriptVote, memberIds: readonly string[]): ScriptVoteTally {
	const points = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
	const members = new Set(memberIds);
	let voted = 0;
	for (const [memberId, ballot] of Object.entries(vote.ballots)) {
		if (!members.has(memberId)) continue;
		voted++;
		ballot.forEach((id, i) => {
			if (!(id in points)) return;
			points[id] += vote.kind === 'ranked' ? vote.options.length - i : 1;
		});
	}
	return {
		voteId: vote.voteId,
		kind: vote.kind,
		options: vote.options,
		points,
		voted,
		members: members.size
	};
}
