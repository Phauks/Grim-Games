/**
 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
 * scripts and players vote on their phones, by single choice, multiple choice or ranking. The
 * room only counts; the Storyteller reads the result and picks. Any number of scripts up to
 * MAX_SCRIPT_VOTE_OPTIONS (Trevor, 2026-10-23: "should not be limited to 2 or 3"), and the
 * same vote can be on the game mode instead (Trevor, 2026-10-23).
 */

/** How players vote: one script, any number of them, or all of them in order. */
import { authorLogo, editionLogo, LOGO_EDITIONS } from '#lib/core/data/script-logo.ts';

export type ScriptVoteKind = 'single' | 'multiple' | 'ranked';

export const SCRIPT_VOTE_KINDS: readonly ScriptVoteKind[] = ['single', 'multiple', 'ranked'];

/** What the vote chooses: the next script, or the next game mode. */
export type VoteSubject = 'script' | 'mode';

export const VOTE_SUBJECTS: readonly VoteSubject[] = ['script', 'mode'];

/** A script on offer: an id the Storyteller's device knows it by, and what phones show. */
export interface ScriptVoteOption {
	id: string;
	name: string;
	author?: string;
	/**
	 * The script's logo, shown beside its name on the ballot (Trevor, 2026-10-24: players see
	 * the logo next to the script's name): TPI's edition logo or the author's https link.
	 */
	logo?: string;
}

/**
 * The time limits the Storyteller can set, in minutes (Trevor, 2026-10-23: "storyteller can
 * create time-limit for vote"). When it runs out the room takes no more ballots.
 */
export const SCRIPT_VOTE_MINUTES = [1, 2, 3, 5, 10] as const;

export const MIN_SCRIPT_VOTE_OPTIONS = 2;
/** A practical ceiling, so one vote can't flood every phone; the only place it is set. */
export const MAX_SCRIPT_VOTE_OPTIONS = 12;
const MAX_ID = 200;
const MAX_TEXT = 120;

export interface ScriptVote {
	voteId: string;
	kind: ScriptVoteKind;
	/** A script vote when absent, as from apps before mode votes. */
	subject?: 'mode';
	options: ScriptVoteOption[];
	/** Each player's ballot, by member id: their choices, in order for a ranked vote. */
	ballots: Record<string, string[]>;
	/** When the time limit runs out (epoch ms, the room's clock); no limit when absent. */
	endsAt?: number;
}

/** What the Storyteller's device sees of the vote: points per option, and who voted. */
export interface ScriptVoteTally {
	voteId: string;
	kind: ScriptVoteKind;
	subject?: 'mode';
	options: ScriptVoteOption[];
	/**
	 * Per option id: votes for a single or multiple choice; for a ranked vote, points by
	 * position (first of three gets 3, then 2, then 1), so the highest is the town's pick.
	 */
	points: Record<string, number>;
	voted: number;
	members: number;
	endsAt?: number;
}

const MAX_LOGO = 500;

/** A logo as script-logo.ts gives one: a synced edition logo, or an author's https link. */
function logoOf(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length > MAX_LOGO) return undefined;
	if (LOGO_EDITIONS.some((edition) => editionLogo(edition) === value)) return value;
	return authorLogo(value);
}

const text = (value: unknown) =>
	typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';

/**
 * A vote from what the Storyteller sent; `undefined` when it isn't one. `minutes` sets a time
 * limit from `now` when it is one of SCRIPT_VOTE_MINUTES; anything else means no limit.
 */
export function newScriptVote(
	voteId: unknown,
	kind: unknown,
	options: unknown,
	minutes?: unknown,
	now = 0,
	subject?: unknown
): ScriptVote | undefined {
	if (typeof voteId !== 'string' || !voteId || voteId.length > MAX_ID) return undefined;
	if (!SCRIPT_VOTE_KINDS.includes(kind as ScriptVoteKind) || !Array.isArray(options)) return;
	const seen = new Set<string>();
	const clean: ScriptVoteOption[] = [];
	for (const raw of options) {
		const { id, name, author, logo } = (raw ?? {}) as Record<string, unknown>;
		if (typeof id !== 'string' || !id || id.length > MAX_ID || seen.has(id)) continue;
		const shown = text(name);
		if (!shown) continue;
		seen.add(id);
		const by = text(author);
		const image = logoOf(logo);
		clean.push({
			id,
			name: shown,
			...(by ? { author: by } : {}),
			...(image ? { logo: image } : {})
		});
	}
	if (clean.length < MIN_SCRIPT_VOTE_OPTIONS || clean.length > MAX_SCRIPT_VOTE_OPTIONS) return;
	const vote: ScriptVote = { voteId, kind: kind as ScriptVoteKind, options: clean, ballots: {} };
	if (subject === 'mode') vote.subject = 'mode';
	if (SCRIPT_VOTE_MINUTES.includes(minutes as (typeof SCRIPT_VOTE_MINUTES)[number])) {
		vote.endsAt = now + (minutes as number) * 60_000;
	}
	return vote;
}

/** Whether the vote's time limit has run out at `now`. */
export function scriptVoteEnded(vote: { endsAt?: number }, now: number): boolean {
	return vote.endsAt !== undefined && now >= vote.endsAt;
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
		...(vote.subject ? { subject: vote.subject } : {}),
		options: vote.options,
		points,
		voted,
		members: members.size,
		...(vote.endsAt !== undefined ? { endsAt: vote.endsAt } : {})
	};
}
