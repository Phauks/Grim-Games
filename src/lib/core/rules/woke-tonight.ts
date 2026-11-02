/**
 * Who woke tonight by their own ability, for the Chambermaid
 * (https://wiki.bloodontheclocktower.com/Chambermaid).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { keepsAbilityWhenDead } from './dead-characters.ts';
import { livesWhileDead } from './game-end.ts';
import { actsTonight, type Night } from './night-order.ts';
import { wakeConditionMet } from './wakes-when.ts';

/**
 * Whether `seatId` woke tonight by their own ability, for the Chambermaid: their character
 * has a step tonight, they still have their ability (alive, kept by another's token, or
 * living on by their own), and its own condition for waking holds (`wakesWhen`: a used
 * Seamstress no longer wakes). A player woken to be asked counts though they decline. A step
 * the Storyteller runs alone tonight (`staysAsleep`: the Gossip's kill) is no waking, nor is
 * one another ability's token stops (`stopsWaking`: a Demon the Exorcist chose, woken only
 * by the Exorcist's ability).
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
	const asleep = rulesOf(id, characters)?.staysAsleep;
	if (asleep === night || asleep === 'both') return false;
	if (stoppedWaking(game, seatId, characters)) return false;
	return wakeConditionMet(game, id, seatId, characters, new Set());
}

/**
 * Whether another ability's token on `seatId` stops them waking for their own ability tonight
 * (`stopsWaking`: the Exorcist's Chosen on the Demon), while a player of that ability has it
 * working; with no such player found, the token counts.
 */
export function stoppedWaking(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return game.seats[seatId].reminders.some((r) => {
		const stops = rulesOf(r.characterId, characters)?.stopsWaking;
		if (stops?.token !== r.label) return false;
		if (stops.type && typeOf(game, seatId, characters) !== stops.type) return false;
		const sources = game.seating.filter(
			(s) => s !== seatId && trueCharacter(game, s, characters) === r.characterId
		);
		return sources.length === 0 || sources.some((s) => abilityState(game, s, characters).works);
	});
}
