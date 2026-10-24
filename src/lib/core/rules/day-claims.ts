import type { CharacterRules, DayClaim } from '../data/character-rules.ts';
import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { CharacterGuess, CharacterLookup, Game } from '../model/index.ts';
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
