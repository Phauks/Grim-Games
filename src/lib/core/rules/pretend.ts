/**
 * The Storyteller's pretend evil team (M26). While a character whose rules allow it is in play
 * (`pretendTeam`: the Atheist, https://wiki.bloodontheclocktower.com/Atheist) there are no evil
 * players, and the Storyteller simulates evil characters that are not in play. The pretend team
 * (`Game.pretend`, set by `SetPretend`) is the seats the Storyteller pretends are Minions and a
 * Demon, so information and night steps can fit them. It is private to the Storyteller and never
 * decides the game.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/** The character types a seat may pretend to be. */
export const PRETEND_TYPES = ['minion', 'demon'] as const;

/** The first character in play, even dead, whose rules allow a pretend evil team. */
export function pretendTeamSource(
	game: Game,
	characters: CharacterLookup
): { seatId: SeatId; characterId: CharacterId } | undefined {
	for (const seatId of game.seating) {
		const characterId = trueCharacter(game, seatId, characters);
		if (characterId && rulesOf(characterId, characters)?.pretendTeam) {
			return { seatId, characterId };
		}
	}
	return undefined;
}

/** The pretend team in seating order, while a character that allows it is in play. */
export function pretendTeam(
	game: Game,
	characters: CharacterLookup
): { seatId: SeatId; characterId: CharacterId }[] {
	if (!game.pretend || !pretendTeamSource(game, characters)) return [];
	const pretend = game.pretend;
	return game.seating.flatMap((seatId) =>
		pretend[seatId] ? [{ seatId, characterId: pretend[seatId] }] : []
	);
}

/**
 * The game as the pretend team makes it look: each pretend seat holds its pretend character,
 * evil, with nothing else changed. Undefined when there is no pretend team.
 */
export function pretendGame(game: Game, characters: CharacterLookup): Game | undefined {
	const team = pretendTeam(game, characters);
	if (team.length === 0) return undefined;
	const seats = { ...game.seats };
	for (const { seatId, characterId } of team) {
		seats[seatId] = { ...seats[seatId], characterId, alignment: 'evil' };
	}
	return { ...game, seats };
}
