import type { CharacterRules, DayClaim, DayUseWho } from '../data/character-rules.ts';
import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { CharacterGuess, CharacterLookup, Game, SeatId } from '../model/index.ts';
import { trueCharacter } from '../model/selectors.ts';

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

/**
 * The player today's log already names for a seat's day ability, to fill in when it is marked
 * used: the first nominator of this seat ("the 1st time you are nominated",
 * https://wiki.bloodontheclocktower.com/Virgin), or the last nominee of another player's
 * nomination (the Judge: "if another player nominated",
 * https://wiki.bloodontheclocktower.com/Judge). The log never knows whom a player chose.
 */
export function dayUseSuggestion(game: Game, seatId: SeatId, who: DayUseWho): SeatId | undefined {
	const nominations = game.today.entries.filter((e) => e.kind === 'nomination');
	if (who === 'nominator') return nominations.find((e) => e.nominee === seatId)?.nominator;
	if (who === 'nominee') return nominations.findLast((e) => e.nominator !== seatId)?.nominee;
	return undefined;
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
