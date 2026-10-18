import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import { seatNumber } from '#lib/core/model/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/** "Seat 3 · Ana · Chef": the seat number, then the player's name and token when known. */
export function seatLabel(game: Game, seatId: SeatId, lookup?: CharacterLookup): string {
	const seat = game.seats[seatId];
	const parts = [t('common.seat', { number: seatNumber(game, seatId) ?? '?' })];
	if (seat?.playerName) parts.push(seat.playerName);
	const character = seat?.characterId && lookup?.get(seat.characterId);
	if (character) parts.push(character.name);
	return parts.join(' · ');
}
