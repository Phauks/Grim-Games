import type { CharacterRules, DayClaim, DayUse, DayUseWho } from '../data/character-rules.ts';
import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { CharacterGuess, CharacterLookup, Game, SeatId } from '../model/index.ts';
import { alignmentOf, trueCharacter, typeOf } from '../model/selectors.ts';
import { abilityState } from './ability.ts';
import { validDeathCauses } from './death-causes.ts';

type RulesLookup = ReadonlyMap<CharacterId, { rules?: CharacterRules }>;

/**
 * The claim a character's player makes in town, which the day log keeps for their ability
 * (`dayClaim` in its rules block; Trevor, 2026-10-23: L56). Guesses (the Juggler), one
 * statement the Storyteller marks true or false (the Gossip), or two statements (the Savant).
 */
export function dayClaim(characterId: CharacterId, characters?: RulesLookup): DayClaim | undefined {
	return rulesOf(characterId, characters)?.dayClaim;
}

/** How many guesses a character's claim may hold a day (`guessLimit` in its rules block). */
export function guessLimit(characterId: CharacterId, characters?: RulesLookup): number | undefined {
	return rulesOf(characterId, characters)?.guessLimit;
}

/**
 * Who marking a character's day ability used asks for (`dayUse` in its rules block; Trevor,
 * 2026-10-30): the player chosen (the Slayer), the nominator (the Virgin) or the nominee whose
 * execution it decided (the Judge). None for an ability about no player (the Artist).
 */
export function dayUseWho(
	characterId: CharacterId,
	characters?: RulesLookup
): DayUseWho | undefined {
	return rulesOf(characterId, characters)?.dayUse?.who;
}

/** A character's whole `dayUse` rule: who, whether they die, and the token that marks it. */
export function dayUseOf(characterId: CharacterId, characters?: RulesLookup): DayUse | undefined {
	return rulesOf(characterId, characters)?.dayUse;
}

/**
 * The characters no player holds whose day ability any living player may use, once each per
 * game (`dayUse.anyone`: the Doomsayer, https://wiki.bloodontheclocktower.com/Doomsayer).
 */
export function anyoneDayUses(game: Game, characters?: RulesLookup): CharacterId[] {
	return game.ruleCharacters.filter((id) => rulesOf(id, characters)?.dayUse?.anyone);
}

/** The players who have used `characterId`'s day ability this game, today included. */
export function dayUseUsers(game: Game, characterId: CharacterId): SeatId[] {
	const out: SeatId[] = [];
	for (const day of [...game.pastDays, game.today])
		for (const e of day.entries)
			if (e.kind === 'ability' && e.characterId === characterId && !out.includes(e.seatId))
				out.push(e.seatId);
	return out;
}

/**
 * Whether enough players live for `characterId`'s day ability (`dayUse.minAlive`: the
 * Doomsayer needs 4, https://wiki.bloodontheclocktower.com/Doomsayer). True without a limit.
 */
export function dayUseOpen(
	game: Game,
	characterId: CharacterId,
	characters?: RulesLookup
): boolean {
	const min = rulesOf(characterId, characters)?.dayUse?.minAlive;
	return min === undefined || game.seating.filter((s) => !game.seats[s].dead).length >= min;
}

/**
 * Who may use an `anyone` day ability now: each living player who hasn't used it this game,
 * while enough players live (`dayUseOpen`). Empty for any other ability.
 */
export function dayUseCandidates(
	game: Game,
	characterId: CharacterId,
	characters?: RulesLookup
): SeatId[] {
	if (!rulesOf(characterId, characters)?.dayUse?.anyone) return [];
	if (!dayUseOpen(game, characterId, characters)) return [];
	const used = dayUseUsers(game, characterId);
	return game.seating.filter((s) => !game.seats[s].dead && !used.includes(s));
}

/**
 * Whether `target` fits an `ally` day use by `seatId`: alive and of the same alignment (the
 * Doomsayer: "a player of their own alignment"). Unknown alignments fit.
 */
export function isDayUseAlly(game: Game, seatId: SeatId, target: SeatId): boolean {
	if (game.seats[target]?.dead) return false;
	const mine = alignmentOf(game, seatId);
	const theirs = alignmentOf(game, target);
	return mine === undefined || theirs === undefined || mine === theirs;
}

/**
 * The player today's log already names for a seat's day ability, to fill in when it is marked
 * used: the first nominator of this seat ("the 1st time you are nominated",
 * https://wiki.bloodontheclocktower.com/Virgin), or the last nominee of another player's
 * nomination (the Judge: "if another player nominated",
 * https://wiki.bloodontheclocktower.com/Judge), or the player this seat nominated (the Golem).
 * The log never knows whom a player chose or who guessed.
 */
export function dayUseSuggestion(game: Game, seatId: SeatId, who: DayUseWho): SeatId | undefined {
	const nominations = game.today.entries.filter((e) => e.kind === 'nomination');
	if (who === 'nominator') return nominations.find((e) => e.nominee === seatId)?.nominator;
	if (who === 'nominee') return nominations.findLast((e) => e.nominator !== seatId)?.nominee;
	// "You may only nominate once per game" (https://wiki.bloodontheclocktower.com/Golem).
	if (who === 'nominated') return nominations.find((e) => e.nominator === seatId)?.nominee;
	return undefined;
}

/**
 * Whether the player a killing day ability (`dayUse.kills`) was used on dies straight away,
 * by its `deathCause` rule (`validDeathCauses`): `dies` when nothing stands in the way, `maybe`
 * when it rests on a false registration, an impaired ability, an unset character or a
 * protection by day (the Storyteller decides), `no` when it can't kill them (the Slayer's
 * shot at a player who never registers as the Demon) or they are already dead.
 */
export function dayUseDeath(
	game: Game,
	characterId: CharacterId,
	target: SeatId,
	characters: CharacterLookup
): 'dies' | 'maybe' | 'no' {
	if (game.seats[target]?.dead) return 'no';
	const cause = validDeathCauses(game, target, characters, { day: true }).find(
		(c) => c.cause === characterId
	);
	if (!cause) return 'no';
	return cause.flags.length > 0 ? 'maybe' : 'dies';
}

/**
 * Each guess once: a player may be guessed as several characters, and several players as the
 * same character (https://wiki.bloodontheclocktower.com/Juggler), but the same pair twice is
 * one guess.
 */
export function distinctGuesses(guesses: readonly CharacterGuess[]): CharacterGuess[] {
	return guesses.filter(
		(g, i) =>
			guesses.findIndex((o) => o.seatId === g.seatId && o.characterId === g.characterId) === i
	);
}

/** The guesses that name the guessed player's true character, each pair once. */
export function correctGuesses(
	game: Game,
	guesses: readonly CharacterGuess[],
	characters: CharacterLookup
): CharacterGuess[] {
	return distinctGuesses(guesses).filter(
		(g) => trueCharacter(game, g.seatId, characters) === g.characterId
	);
}

/**
 * What a day ability's player may be told about the player it was used on (`dayUse.answer`):
 * - `right`: that player carries one of this character's impairing reminders, so they learn
 *   the Demon player (`demons`);
 * - `wrong`: they don't, so they learn any player who isn't the Demon;
 * - `any`: the ability doesn't work (drunk or poisoned), so any player;
 * - `dead`: its player has died, and the part that answers ends with death (a dead
 *   Puzzlemaster may not guess, https://wiki.bloodontheclocktower.com/Puzzlemaster).
 * Only this character's own reminder counts: a player drunk by other means is a wrong guess.
 */
export type DayUseAnswerOptions =
	{ kind: 'right' | 'wrong'; demons: SeatId[] } | { kind: 'any' } | { kind: 'dead' };

export function dayUseAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	target: SeatId,
	characters: CharacterLookup
): DayUseAnswerOptions | undefined {
	const rules = rulesOf(characterId, characters);
	if (rules?.dayUse?.answer !== 'demon-if-marked') return undefined;
	if (game.seats[seatId]?.dead) return { kind: 'dead' };
	if (abilityState(game, seatId, characters).impairments.length > 0) return { kind: 'any' };
	const labels = Object.keys(rules.impairs?.tokens ?? {});
	const marked = (game.seats[target]?.reminders ?? []).some(
		(r) => r.characterId === characterId && labels.includes(r.label)
	);
	const demons = game.seating.filter((s) => typeOf(game, s, characters) === 'demon');
	return { kind: marked ? 'right' : 'wrong', demons };
}
