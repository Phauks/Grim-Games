import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import { seatNumber } from '#lib/core/model/index.ts';

/** "Seat 3 · Ana · Chef": the seat number, then the player's name and token when known. */
export function seatLabel(game: Game, seatId: SeatId, lookup?: CharacterLookup): string {
	const seat = game.seats[seatId];
	const parts = [`Seat ${seatNumber(game, seatId) ?? '?'}`];
	if (seat?.playerName) parts.push(seat.playerName);
	const character = seat?.characterId && lookup?.get(seat.characterId);
	if (character) parts.push(character.name);
	return parts.join(' · ');
}
