import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import { characterStepSeats, wakesMarked } from '#lib/core/rules/night/info/steps.ts';
import type { NightStep } from '#lib/core/rules/night/night-order.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/**
 * A character in play more than once wakes once for each of its players, one straight after
 * the other, each step for that seat alone (Trevor, 2026-11-12: "Need to invoke separate wake
 * ups ... if duplicate characters", e.g. Village Idiots; picked "Build as shown" 2026-11-13).
 * Each copy has its own id, so it is ticked on its own, and its own seat, so its answers and
 * its band (the seat and its alignment) are that player's. Not for a character whose players
 * share one step (`oneNightStep`: Legion), one whose step wakes the players it marks, or a step
 * already for one seat (a changed character's, a second wake, a pretended character's).
 */
export function withCopySteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): (T | NightStep)[] {
	return steps.flatMap((step): (T | NightStep)[] => {
		const character = step.character;
		if (
			step.kind !== 'character' ||
			!character ||
			step.changed ||
			step.again ||
			step.pretend ||
			step.gained ||
			step.storytellerAbility ||
			rulesFor(game, character.id, characters)?.oneNightStep ||
			wakesMarked(character.id, characters)
		)
			return [step];
		const seats = characterStepSeats(game, character.id, characters);
		if (seats.length < 2) return [step];
		return seats.map((seatId) => ({ ...step, id: `${step.id}:copy:${seatId}`, copy: { seatId } }));
	});
}

/** The step's place in the night sheet: a copy's is its character's step. */
export const sheetStepId = (step: Pick<NightStep, 'id' | 'copy' | 'character'>): string =>
	step.copy && step.character ? step.character.id : step.id;
