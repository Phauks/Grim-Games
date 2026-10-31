/**
 * Who woke tonight by their own ability, for the Chambermaid
 * (https://wiki.bloodontheclocktower.com/Chambermaid).
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { keepsAbilityWhenDead } from './dead-characters.ts';
import { livesWhileDead } from './game-end.ts';
import { actsTonight, type Night } from './night-order.ts';
import { wakeConditionMet } from './wakes-when.ts';

/**
 * Whether `seatId` woke tonight by their own ability, for the Chambermaid: their character
 * has a step tonight, they still have their ability (alive, kept by another's token, or
 * living on by their own), and its own condition for waking holds (`wakesWhen`: a used
 * Seamstress no longer wakes). A player woken to be asked counts though they decline.
 */
export function wokeTonight(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	night: Night
): boolean {
	const id = trueCharacter(game, seatId, characters);
	const character = id === undefined ? undefined : characters.get(id);
	if (id === undefined || !character || !actsTonight(character, night)) return false;
	if (
		game.seats[seatId].dead &&
		!keepsAbilityWhenDead(game, seatId, characters) &&
		!livesWhileDead(game, seatId, characters)
	)
		return false;
	return wakeConditionMet(game, id, seatId, characters, new Set());
}
