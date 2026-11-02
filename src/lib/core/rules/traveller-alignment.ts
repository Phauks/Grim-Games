/**
 * A Traveller's alignment is the Storyteller's choice and is often not made when the
 * Traveller sits down (https://wiki.bloodontheclocktower.com/Travellers; Trevor,
 * 2026-10-16). Until it is set, the rules treat it as unknown (`registrationWorlds`), and
 * the night order starts with a step to choose it.
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, isTraveller } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { NightStep } from './night-order.ts';

/** The id of the night step that asks for Traveller alignments. */
export const TRAVELLER_ALIGNMENT_STEP = 'traveller-alignment';

/** Travellers whose alignment is not set, in seating order. */
export function travellersWithoutAlignment(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(s) => isTraveller(game, s, characters) && alignmentOf(game, s) === undefined
	);
}

/**
 * The night steps with a first step, before Dusk, to choose the alignment of each Traveller
 * in `travellers` (the seats), when there are any. The step's text is the UI's to word.
 */
export function withTravellerAlignmentStep<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): (T | NightStep)[] {
	const travellers = travellersWithoutAlignment(game, characters);
	if (travellers.length === 0) return [...steps];
	const step: NightStep = {
		id: TRAVELLER_ALIGNMENT_STEP,
		kind: 'custom',
		title: 'Traveller alignment',
		afterDawn: false,
		placement: 'marker',
		notes: [],
		travellers
	};
	return [step, ...steps];
}

/** The id of the night step that offers to bring Travellers not in play into play. */
export const TRAVELLER_JOINS_STEP = 'traveller-joins';

/** Travellers sitting out (`Seat.notInPlay`), in seating order. */
export function travellersNotInPlay(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter((s) => game.seats[s]?.notInPlay && isTraveller(game, s, characters));
}

/**
 * The night steps with a step to bring each Traveller not in play into play, when there are
 * any (Trevor, 2026-11-02: the night offers it, the Storyteller decides). The wiki lets a
 * Traveller join at any time (https://wiki.bloodontheclocktower.com/Travellers). Placed
 * right after Dusk with the other steps that come before anyone wakes.
 */
export function withTravellerJoinsStep<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): (T | NightStep)[] {
	const travellers = travellersNotInPlay(game, characters);
	if (travellers.length === 0) return [...steps];
	const step: NightStep = {
		id: TRAVELLER_JOINS_STEP,
		kind: 'custom',
		title: 'Travellers not in play',
		afterDawn: false,
		placement: 'marker',
		notes: [],
		travellers
	};
	return [step, ...steps];
}
