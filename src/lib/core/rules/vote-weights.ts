/**
 * What each vote counts for and who may vote (M9a), from the `voteWeight` and `voter` parts of
 * the characters in play, and the tally of a nomination's recorded votes (`RecordVotes`).
 *
 * A vote normally adds 1 to the tally; a dead player votes with their one ghost vote
 * (https://wiki.bloodontheclocktower.com/Dead_Player) unless their character gives them votes
 * that need no token (`afterDeath`, the Banshee). A `voteWeight` multiplies what the vote
 * counts as while its character's ability works: two on one player multiply (the Thief and
 * the Bureaucrat on one player give -3, https://wiki.bloodontheclocktower.com/Bureaucrat).
 * Exiles are never affected (https://wiki.bloodontheclocktower.com/Exile), so none of this
 * applies to them.
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import { rulesIn } from '#lib/core/data/rules/index.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { registersAsDead, trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { blockThreshold, votesWithoutToken } from './voting.ts';
import { mayVote } from './voting-table.ts';

type Nomination = Extract<DayEntry, { kind: 'nomination' }>;
type VoterRule = NonNullable<CharacterRules['voter']>;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A character whose ability changes what a seat's vote counts as. */
export interface WeightSource {
	characterId: CharacterId;
	weight: number;
	/** The reminder on the seat that carries it, when it comes from one. */
	reminderId?: ReminderId;
}

/**
 * Whether the character whose reminder sits on `carrier` still has a working ability: some
 * other player of it works, or none is seated (a Loric's token, such as the Ug hat, or one
 * left by a gained ability).
 */
function sourceWorks(
	game: Game,
	carrier: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	const seats = game.seating.filter(
		(s) => s !== carrier && trueCharacter(game, s, characters) === characterId
	);
	return seats.length === 0 || seats.some((s) => abilityState(game, s, characters).works);
}

/**
 * What changes a seat's vote, while each character's ability works: the reminders it
 * carries whose character's `voteWeight` names them (once per character), and its own
 * character's `voteWeight.self`. A drunk or poisoned Thief's chosen player votes normally.
 */
export function weightSources(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): WeightSource[] {
	const seat = game.seats[seatId];
	if (!seat) return [];
	const out: WeightSource[] = [];
	for (const r of seat.reminders) {
		const rule = rulesIn(game, r.characterId, characters)?.voteWeight;
		if (!rule || !('reminder' in rule) || !same(rule.reminder, r.label)) continue;
		if (out.some((s) => s.characterId === r.characterId)) continue;
		if (!sourceWorks(game, seatId, r.characterId, characters)) continue;
		out.push({ characterId: r.characterId, weight: rule.weight, reminderId: r.reminderId });
	}
	const own = trueCharacter(game, seatId, characters);
	const rule = own === undefined ? undefined : rulesIn(game, own, characters)?.voteWeight;
	if (own !== undefined && rule && 'self' in rule && abilityState(game, seatId, characters).works)
		out.push({ characterId: own, weight: rule.weight });
	return out;
}

/** The votes one raised hand casts before any weight: 1, or a dead player's token-free votes. */
function baseVotes(game: Game, seatId: SeatId, characters: CharacterLookup): number {
	if (!registersAsDead(game, seatId)) return 1;
	return votesWithoutToken(game, seatId, characters) ?? 1;
}

/** What a seat's vote adds to the tally now: its votes times every weight on it. */
export function voteWorth(game: Game, seatId: SeatId, characters: CharacterLookup): number {
	return weightSources(game, seatId, characters).reduce(
		(worth, s) => worth * s.weight,
		baseVotes(game, seatId, characters)
	);
}

/** A nomination's recorded votes added up: each voter's worth, in seat order. */
export interface VoteTally {
	total: number;
	votes: { seatId: SeatId; worth: number }[];
}

/**
 * The tally of a nomination's recorded votes, or undefined while none are recorded. Each
 * vote counts as it would now (`voteWorth`): a weight that ended since the vote (the Thief
 * died) no longer shows.
 */
export function tallyOf(
	game: Game,
	nomination: Nomination,
	characters: CharacterLookup
): VoteTally | undefined {
	if (!nomination.votes) return undefined;
	const votes = nomination.votes.voters.map((seatId) => ({
		seatId,
		worth: voteWorth(game, seatId, characters)
	}));
	return { total: votes.reduce((sum, v) => sum + v.worth, 0), votes };
}

/** A seat's own character's `voter` rule, while its ability works. */
export function voterRule(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): { characterId: CharacterId; rule: VoterRule } | undefined {
	const characterId = trueCharacter(game, seatId, characters);
	if (characterId === undefined) return undefined;
	const rule = rulesIn(game, characterId, characters)?.voter;
	if (!rule || !abilityState(game, seatId, characters).works) return undefined;
	return { characterId, rule };
}

/** Seats carrying `characterId`'s `label` reminder (the Butler's Master), in seat order. */
export function carriersOf(game: Game, characterId: CharacterId, label: ReminderLabel): SeatId[] {
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && same(r.label, label))
	);
}

/** Whether a `must` voter rule applies today: enough players are alive. */
export function mustVoteNow(game: Game, rule: VoterRule): boolean {
	return !!rule.must && blockThreshold(game).alive >= (rule.minAlive ?? 0);
}

/** One seat's voting facts, for a vote sheet to show (M9e); data, never text. */
export interface VoteHint {
	seatId: SeatId;
	/** What their vote adds to the tally now (`voteWorth`). */
	worth: number;
	/** The characters whose abilities change `worth`. */
	worthFrom: CharacterId[];
	/**
	 * A dead player's vote: their ghost vote `unused` or `used`, or `free` when they vote
	 * without one (their character's `afterDeath`, or the table's `deadNeedNoToken`, the
	 * Voudon). Absent while alive.
	 */
	ghostVote?: 'unused' | 'used' | 'free';
	/**
	 * They may not vote today: only the dead and that character's player may (the Voudon,
	 * `mayVote`). The rules below that need them to vote are left out while this is set.
	 */
	mayNotVote?: { characterId: CharacterId };
	/** They may vote only if one of `seats` votes too (the Butler's Master). */
	onlyWith?: { characterId: CharacterId; seats: SeatId[] };
	/** They must vote on every nomination today (the Zealot, with enough players alive). */
	mustVote?: { characterId: CharacterId };
	/** They vote only by using one of the `tokens` they hold (the Beggar). */
	needsToken?: { characterId: CharacterId; tokens: number };
}

/** Every seat in play's voting facts, in seat order. */
export function voteHints(game: Game, characters: CharacterLookup): VoteHint[] {
	return game.seating
		.filter((s) => !game.seats[s].notInPlay)
		.map((seatId) => {
			const seat = game.seats[seatId];
			const sources = weightSources(game, seatId, characters);
			const hint: VoteHint = {
				seatId,
				worth: voteWorth(game, seatId, characters),
				worthFrom: sources.map((s) => s.characterId)
			};
			const dead = registersAsDead(game, seatId);
			if (dead) {
				const free = votesWithoutToken(game, seatId, characters) !== undefined;
				hint.ghostVote = free ? 'free' : seat.ghostVoteUsed ? 'used' : 'unused';
			}
			const allowed = mayVote(game, seatId, characters);
			if (!allowed.ok) {
				hint.mayNotVote = { characterId: allowed.by };
				return hint;
			}
			const voter = voterRule(game, seatId, characters);
			if (voter?.rule.onlyWith) {
				const seats = carriersOf(game, voter.characterId, voter.rule.onlyWith);
				hint.onlyWith = { characterId: voter.characterId, seats };
			}
			if (voter && mustVoteNow(game, voter.rule))
				hint.mustVote = { characterId: voter.characterId };
			// A dead player votes with their ghost vote, as anyone does; given tokens are lost.
			if (voter?.rule.needsToken && !dead)
				hint.needsToken = { characterId: voter.characterId, tokens: seat.voteTokens ?? 0 };
			return hint;
		});
}

/**
 * The seats whose vote is unusual today, for the Storyteller to count by (M9e; Trevor,
 * 2026-11-01: votes are run outside the app, so nothing is recorded).
 */
export function voteNotes(game: Game, characters: CharacterLookup): VoteHint[] {
	return voteHints(game, characters).filter(
		(hint) =>
			hint.worth !== 1 ||
			hint.mayNotVote ||
			hint.onlyWith ||
			hint.mustVote ||
			hint.needsToken ||
			hint.ghostVote === 'free'
	);
}
