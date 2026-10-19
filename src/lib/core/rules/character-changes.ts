/**
 * A night step to wake each player whose character changed since dawn and show them their
 * new character, so the Storyteller never forgets to tell them (the character changes
 * audit, Trevor 2026-10-19: "go ahead on character changes"). The wiki says the player
 * learns it: the new Imp is woken and shown "You are" and the Imp token
 * (https://wiki.bloodontheclocktower.com/Imp); so is a player the Pit-Hag changes
 * (https://wiki.bloodontheclocktower.com/Pit-Hag) or a Farmer's heir
 * (https://wiki.bloodontheclocktower.com/Farmer).
 *
 * The changes come from the game's log (`changedCharacters` in the engine). Each step goes
 * just before Dawn, in seating order. The step names the seat; the UI draws its player.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import type { NightStep } from './night-order.ts';

/** The id prefix of a wake step: `changed@<seat>`. */
export const CHANGED_STEP = 'changed';

/** The night steps with a wake step before Dawn for each seat in `changes`. */
export function withCharacterChangeSteps<T extends NightStep>(
	steps: readonly T[],
	changes: readonly { seatId: SeatId; characterId: CharacterId }[],
	characters: CharacterLookup
): (T | NightStep)[] {
	const added: NightStep[] = changes.flatMap(({ seatId, characterId }) => {
		const character = characters.get(characterId);
		if (!character) return [];
		return [
			{
				id: `${CHANGED_STEP}@${seatId}`,
				kind: 'custom',
				character,
				reminder: `Wake this player. Show the *YOU ARE* info token, then the ${character.name} token.`,
				afterDawn: false,
				placement: 'marker',
				notes: [],
				changed: { seatId, characterId }
			}
		];
	});
	if (added.length === 0) return [...steps];
	const dawn = steps.findIndex((s) => s.id === 'dawn');
	const afterDawn = steps.findIndex((s) => s.afterDawn);
	const at = dawn >= 0 ? dawn : afterDawn >= 0 ? afterDawn : steps.length;
	return [...steps.slice(0, at), ...added, ...steps.slice(at)];
}
