import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
import { gameModeOf } from '#lib/features/modes/game-mode.ts';

/** A Traveller the town knows is in play, and who plays it. */
export interface TravellerInPlay {
	characterId: CharacterId;
	seatNumber: number;
	playerName?: string;
}

/**
 * Whether the town knows this game's Travellers: not when its mode deals them secretly from
 * the bag (Stowed Away; Trevor, 2026-10-19: "this may need to change").
 */
export function travellersArePublic(gameId: GameId): boolean {
	return (gameModeOf(gameId)?.parts.travellers?.inBag ?? 0) === 0;
}

/**
 * Which characters the town sees on the public table: Travellers, unless the mode hides them.
 * The same test for players' phones (the room) and the Storyteller's copy of their script.
 */
export function publicTravellerTest(
	gameId: GameId,
	characters: ReadonlyMap<CharacterId, { type: string }>
): (id: CharacterId) => boolean {
	const shown = travellersArePublic(gameId);
	return (id) => shown && characters.get(id)?.type === 'traveller';
}

/** The Travellers on the public table, as the players' script shows them. */
export function travellersInPlay(seats: readonly PublicSeat[]): TravellerInPlay[] {
	return seats.flatMap((s) =>
		s.traveller
			? [
					{
						characterId: s.traveller,
						seatNumber: s.seatNumber,
						...(s.playerName ? { playerName: s.playerName } : {})
					}
				]
			: []
	);
}
