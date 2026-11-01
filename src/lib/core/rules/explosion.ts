/**
 * Exploding when executed (`execution.explodes` in a character's rules): when the Boomdandy is
 * executed, all but 3 players die; then everyone points, and the player most pointed at dies,
 * or nobody on a tie (https://wiki.bloodontheclocktower.com/Boomdandy). It happens even if
 * the Boomdandy doesn't die, but not for a death by other means. The board asks who lives,
 * then who was pointed at most; the Storyteller decides, so nothing here happens on its own.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';

export interface Explosion {
	/** The character that explodes; the cause of the deaths. */
	characterId: CharacterId;
	/** How many players are left alive (the Boomdandy's 3). */
	survivors: number;
}

/**
 * What executing the player in `seatId` sets off in `game` (the game just before the
 * execution): an explosion when their character explodes and their ability works.
 */
export function explosionOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): Explosion | undefined {
	const characterId = trueCharacter(game, seatId, characters);
	const survivors = characterId && rulesOf(characterId, characters)?.execution?.explodes;
	if (!characterId || !survivors || !abilityState(game, seatId, characters).works) return undefined;
	return { characterId, survivors };
}

/** Whether a choice of who lives leaves the Demon out: the game would end at once. */
export function survivorsLackDemon(
	game: Game,
	lives: readonly SeatId[],
	characters: CharacterLookup
): boolean {
	return !lives.some((seatId) => typeOf(game, seatId, characters) === 'demon');
}
