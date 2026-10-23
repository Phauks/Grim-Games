import type { CharacterRules, DayClaim } from '../data/character-rules.ts';
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

/** The guessed players whose true character is the one guessed. */
export function correctGuesses(
	game: Game,
	guesses: readonly CharacterGuess[],
	characters: CharacterLookup
): SeatId[] {
	return guesses
		.filter((g) => trueCharacter(game, g.seatId, characters) === g.characterId)
		.map((g) => g.seatId);
}
