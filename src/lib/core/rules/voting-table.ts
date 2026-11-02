/**
 * Rules that change voting for the whole table while a character's ability works (M9b), from
 * the `voting` part of the characters in play:
 * - only the Voudon and the dead may vote, the dead spend no vote token, and the nominee with
 *   the most votes is executed without needing half the living
 *   (https://wiki.bloodontheclocktower.com/Voudon);
 * - votes are cast with eyes closed and the tally stays secret
 *   (https://wiki.bloodontheclocktower.com/Organ_Grinder);
 * - on the final day every dead player regains their vote token
 *   (https://wiki.bloodontheclocktower.com/Ferryman).
 * Exiles are never affected (https://wiki.bloodontheclocktower.com/Exile): anyone may support
 * one and the count stays half of every player.
 *
 * A source is a seated player whose ability works (their own character's, or one they gained
 * or hold, such as the Alchemist's Minion), an ability the Storyteller holds (the Plague
 * Doctor's Minion), or a Fabled or Loric in play (`Game.ruleCharacters`), which always works.
 */
import type { Voting } from '#lib/core/data/parts/voting.ts';
import { rulesIn, rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { registersAsDead, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { gainedAbilities } from './gained-abilities.ts';

/** One working ability that changes how the table votes. */
export interface TableVoting {
	characterId: CharacterId;
	/** The player whose ability it is; unset for a Fabled, Loric or the Storyteller's. */
	seatId?: SeatId;
	rule: Voting;
}

/** Every working `voting` rule in play, seated players first in seat order. */
export function tableVoting(game: Game, characters: CharacterLookup): TableVoting[] {
	const out: TableVoting[] = [];
	const add = (characterId: CharacterId, seatId?: SeatId) => {
		const rule = rulesIn(game, characterId, characters)?.voting;
		if (!rule) return;
		if (out.some((t) => t.characterId === characterId && t.seatId === seatId)) return;
		out.push({ characterId, ...(seatId !== undefined ? { seatId } : {}), rule });
	};
	for (const seatId of game.seating) {
		if (game.seats[seatId].notInPlay) continue;
		const id = trueCharacter(game, seatId, characters);
		if (id !== undefined && abilityState(game, seatId, characters).works) add(id, seatId);
	}
	for (const gained of gainedAbilities(game, characters)) {
		if (gained.status === 'has-ability' && abilityState(game, gained.seatId, characters).works)
			add(gained.characterId, gained.seatId);
	}
	for (const held of game.storytellerAbilities ?? []) add(held.characterId);
	for (const id of game.ruleCharacters) add(id);
	return out;
}

type Flag = 'voters' | 'deadNeedNoToken' | 'noMajority' | 'secret' | 'deadRegainToken';

/** The first working source of one `voting` rule, or undefined when none is in play. */
export function tableRule(
	game: Game,
	characters: CharacterLookup,
	flag: Flag
): TableVoting | undefined {
	return tableVoting(game, characters).find((t) => t.rule[flag] !== undefined);
}

/**
 * Whether a seat may vote on a nomination under the table's rules: always, unless a
 * `voters: "self-and-dead"` rule works and they are neither dead (as they register: an
 * apparently dead Zombuul votes, the Voudon page's example) nor that rule's own player.
 * `by` names the character that stops them.
 */
export function mayVote(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): { ok: true } | { ok: false; by: CharacterId } {
	if (registersAsDead(game, seatId)) return { ok: true };
	const limits = tableVoting(game, characters).filter((t) => t.rule.voters === 'self-and-dead');
	if (limits.length === 0 || limits.some((t) => t.seatId === seatId)) return { ok: true };
	return { ok: false, by: limits[0].characterId };
}

/** Whether dead players vote without spending their vote token today (the Voudon). */
export function deadVoteFree(game: Game, characters: CharacterLookup): boolean {
	return tableRule(game, characters, 'deadNeedNoToken') !== undefined;
}

/**
 * The character whose ability means no majority is needed, so one vote can put a nominee on
 * the block and the most votes wins (the Voudon), or undefined while the usual half of the
 * living applies.
 */
export function mostVotesWins(game: Game, characters: CharacterLookup): CharacterId | undefined {
	return tableRule(game, characters, 'noMajority')?.characterId;
}

/**
 * Whether votes are secret now (the sober Organ Grinder, alive): players vote with eyes
 * closed, and the Storyteller announces neither the tally, how many voted, nor who is about to
 * die, only the execution once nominations close. A vote screen shown to players (M9e) hides
 * the tally and Voted marks while this is true; a dead voter's spent token leaves at dusk, not
 * straight after the vote. An Organ Grinder who chose to be drunk ("Drunk" on them) has no
 * ability, so votes are open that day.
 */
export function votesSecret(game: Game, characters: CharacterLookup): boolean {
	return tableRule(game, characters, 'secret') !== undefined;
}

/**
 * The dead players who get their vote token back on the final day (the Ferryman): every one
 * who has spent it, whatever their alignment, while a `deadRegainToken` rule is in play; none
 * on another day. A player who still has theirs gets no second one, and a token spent on the
 * final day is gone for good, so this is for the start of that day. The app does not judge
 * which day is the final one: the wiki leaves it to the Storyteller (the day that, without
 * the Demon's execution, evil wins, usually with 3 alive), so `finalDay` is their call.
 */
export function ghostVotesRestored(
	game: Game,
	characters: CharacterLookup,
	finalDay: boolean
): SeatId[] {
	if (!finalDay || !tableRule(game, characters, 'deadRegainToken')) return [];
	return game.seating.filter(
		(s) => !game.seats[s].notInPlay && registersAsDead(game, s) && game.seats[s].ghostVoteUsed
	);
}

/** The table's rules as the town sees them, for `townCounts`. */
export interface TownVoting {
	noMajority?: true;
	deadNeedNoToken?: true;
}

/**
 * The `voting` rules the town knows of: those of each living Traveller it knows (the Voudon
 * tells everyone who they are, https://wiki.bloodontheclocktower.com/Travellers). The town
 * cannot know a Traveller is drunk or poisoned, so a phone counts as if the ability works.
 */
export function townVoting(
	seats: readonly { dead: boolean; traveller?: string; notInPlay?: true }[],
	characters: CharacterLookup
): TownVoting {
	const out: TownVoting = {};
	for (const seat of seats) {
		if (seat.dead || seat.notInPlay || !seat.traveller) continue;
		const rule = rulesOf(seat.traveller, characters)?.voting;
		if (rule?.noMajority) out.noMajority = true;
		if (rule?.deadNeedNoToken) out.deadNeedNoToken = true;
	}
	return out;
}
