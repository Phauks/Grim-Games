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
	/**
	 * The script's characters, for its details on the ballot (Trevor, 2026-10-26: players can
	 * view details of each script): ids, and a homebrew character's own name and team. Absent
	 * from a game-mode vote and from apps before it.
	 */
	characters?: ScriptVoteCharacter[];
}

/** A character on an offered script, as BotC Scripts lists one: enough for a badge. */
export interface ScriptVoteCharacter {
	id: string;
	name?: string;
	team?: string;
}

/**
 * The time limits the Storyteller can set, in minutes (Trevor, 2026-10-23: "storyteller can
 * create time-limit for vote"). When it runs out the room takes no more ballots.
 */
export const SCRIPT_VOTE_MINUTES = [1, 2, 3, 5, 10] as const;

/**
 * When the Storyteller ends the vote early, phones get this long to vote before it closes
 * (Trevor, 2026-10-26: "give 15 second final vote warning to players").
 */
export const FINAL_CALL_SECONDS = 15;

export const MIN_SCRIPT_VOTE_OPTIONS = 2;
/** A practical ceiling, so one vote can't flood every phone; the only place it is set. */
export const MAX_SCRIPT_VOTE_OPTIONS = 12;
const MAX_ID = 200;
const MAX_TEXT = 120;
/** As many characters as BotC Scripts' own reader keeps (readEntries). */
const MAX_CHARACTERS = 60;

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
	/** The Storyteller ended it early: the last FINAL_CALL_SECONDS before `endsAt`. */
	finalCall?: true;
	/** Players see the count too (Trevor, 2026-10-26); the Storyteller only when absent. */
	showTally?: true;
}

/** What the Storyteller's device sees of the vote: points per option, and who voted. */
export interface ScriptVoteTally {
	voteId: string;
	kind: ScriptVoteKind;
	subject?: 'mode';
	options: ScriptVoteOption[];
	/**
	 * Per option id: votes for a single or multiple choice; for a ranked vote, its votes in
	 * the last round of the instant runoff (rankedRunoff).
	 */
	points: Record<string, number>;
	/** A ranked vote: the round each option was dropped in, from 1, for those dropped. */
	out?: Record<string, number>;
	/** A ranked vote: the option with more than half the ballots; none on a tie. */
	winner?: string;
	voted: number;
	members: number;
	endsAt?: number;
	finalCall?: true;
	showTally?: true;
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

/** An offered script's characters, each id once; `undefined` when there are none. */
function charactersOf(value: unknown): ScriptVoteCharacter[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const seen = new Set<string>();
	const list: ScriptVoteCharacter[] = [];
	for (const raw of value) {
		if (list.length >= MAX_CHARACTERS) break;
		const { id, name, team } = (raw ?? {}) as Record<string, unknown>;
		if (typeof id !== 'string' || !id || id.length > 40 || seen.has(id)) continue;
		seen.add(id);
		const shown = text(name).slice(0, 60);
		const side = text(team).slice(0, 20);
		list.push({ id, ...(shown ? { name: shown } : {}), ...(side ? { team: side } : {}) });
	}
	return list.length ? list : undefined;
}

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
	subject?: unknown,
	showTally?: unknown
): ScriptVote | undefined {
	if (typeof voteId !== 'string' || !voteId || voteId.length > MAX_ID) return undefined;
	if (!SCRIPT_VOTE_KINDS.includes(kind as ScriptVoteKind) || !Array.isArray(options)) return;
	const seen = new Set<string>();
	const clean: ScriptVoteOption[] = [];
	for (const raw of options) {
		const { id, name, author, logo, characters } = (raw ?? {}) as Record<string, unknown>;
		if (typeof id !== 'string' || !id || id.length > MAX_ID || seen.has(id)) continue;
		const shown = text(name);
		if (!shown) continue;
		seen.add(id);
		const by = text(author);
		const image = logoOf(logo);
		const cast = charactersOf(characters);
		clean.push({
			id,
			name: shown,
			...(by ? { author: by } : {}),
			...(image ? { logo: image } : {}),
			...(cast ? { characters: cast } : {})
		});
	}
	if (clean.length < MIN_SCRIPT_VOTE_OPTIONS || clean.length > MAX_SCRIPT_VOTE_OPTIONS) return;
	const vote: ScriptVote = { voteId, kind: kind as ScriptVoteKind, options: clean, ballots: {} };
	if (subject === 'mode') vote.subject = 'mode';
	if (showTally === true) vote.showTally = true;
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
 * Ends the vote early: phones get FINAL_CALL_SECONDS more, or what is left of the time limit
 * if that is sooner (Trevor, 2026-10-26). Once ended or in its final call, nothing changes.
 */
export function endScriptVoteSoon(vote: ScriptVote, now: number): ScriptVote {
	if (vote.finalCall || scriptVoteEnded(vote, now)) return vote;
	const soon = now + FINAL_CALL_SECONDS * 1000;
	if (vote.endsAt !== undefined && vote.endsAt <= soon) return vote;
	return { ...vote, endsAt: soon, finalCall: true };
}

/**
 * A player's ballot, checked against the vote: one choice for a single choice, at least one
 * for a multiple choice or a ranking, in order for a ranking, which need not place every
 * option (Trevor, 2026-10-26). `undefined` when it doesn't fit; an empty ballot is a
 * withdrawn vote, which castScriptBallot handles before this.
 */
export function cleanBallot(vote: ScriptVote, choices: unknown): string[] | undefined {
	if (!Array.isArray(choices)) return undefined;
	const ids = new Set(vote.options.map((o) => o.id));
	if (!choices.every((c) => typeof c === 'string' && ids.has(c))) return undefined;
	const unique = [...new Set(choices as string[])];
	if (unique.length !== choices.length || unique.length === 0) return undefined;
	if (vote.kind === 'single' && unique.length !== 1) return undefined;
	return unique;
}

/**
 * An instant runoff over ranked ballots (Trevor, 2026-10-26: "attempt for majority from 1
 * vote. If 1 vote does not win, remove any votes for lowest and move down"). Each round
 * counts every ballot for its highest option still in; an option with more than half the
 * ballots still counting wins. Otherwise the lowest is dropped and its ballots move to their
 * next choice. Lowest ties go to the one with fewer votes in the latest earlier round where
 * they differ, then to the one offered later. When every option left has the same count,
 * there is no winner and the Storyteller decides.
 */
export function rankedRunoff(
	optionIds: readonly string[],
	ballots: readonly (readonly string[])[]
): { rounds: Record<string, number>[]; out: Record<string, number>; winner?: string } {
	const left = [...optionIds];
	const rounds: Record<string, number>[] = [];
	const out: Record<string, number> = {};
	while (left.length) {
		const counts = Object.fromEntries(left.map((id) => [id, 0]));
		let counting = 0;
		for (const ballot of ballots) {
			const top = ballot.find((id) => id in counts);
			if (top === undefined) continue;
			counts[top]++;
			counting++;
		}
		rounds.push(counts);
		const values = left.map((id) => counts[id]);
		const most = Math.max(...values);
		if (counting > 0 && most * 2 > counting) {
			return { rounds, out, winner: left.find((id) => counts[id] === most) };
		}
		const least = Math.min(...values);
		if (least === most) break;
		const tied = left.filter((id) => counts[id] === least);
		let drop = tied[tied.length - 1];
		for (let r = rounds.length - 2; r >= 0 && tied.length > 1; r--) {
			const fewest = Math.min(...tied.map((id) => rounds[r][id]));
			const still = tied.filter((id) => rounds[r][id] === fewest);
			if (still.length < tied.length) {
				tied.splice(0, tied.length, ...still);
				drop = tied[tied.length - 1];
			}
		}
		out[drop] = rounds.length;
		left.splice(left.indexOf(drop), 1);
	}
	return { rounds, out };
}

export function tallyScriptVote(vote: ScriptVote, memberIds: readonly string[]): ScriptVoteTally {
	const points = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
	const members = new Set(memberIds);
	const counted = Object.entries(vote.ballots).flatMap(([memberId, ballot]) =>
		members.has(memberId) ? [ballot] : []
	);
	let runoff: ReturnType<typeof rankedRunoff> | undefined;
	if (vote.kind === 'ranked') {
		runoff = rankedRunoff(
			vote.options.map((o) => o.id),
			counted
		);
		// Each option's votes in the last round it was in.
		for (const round of runoff.rounds) Object.assign(points, round);
	} else {
		for (const ballot of counted) for (const id of ballot) if (id in points) points[id]++;
	}
	return {
		voteId: vote.voteId,
		kind: vote.kind,
		...(vote.subject ? { subject: vote.subject } : {}),
		options: vote.options,
		points,
		...(runoff ? { out: runoff.out } : {}),
		...(runoff?.winner ? { winner: runoff.winner } : {}),
		voted: counted.length,
		members: members.size,
		...(vote.endsAt !== undefined ? { endsAt: vote.endsAt } : {}),
		...(vote.finalCall ? { finalCall: true as const } : {}),
		...(vote.showTally ? { showTally: true as const } : {})
	};
}
