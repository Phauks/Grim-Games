/**
 * How a seat is named in sentences: "Seat 3 (Alex)", or "Seat 3" with no player name. One
 * helper for the board's alerts, confirmations and seat sheet (component review, 2026-10-18:
 * three copies, all in English).
 */
import { seatNumber, type Game, type SeatId } from '#lib/core/model/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

export function seatLabel(game: Game, seatId: SeatId): string {
	const seat = t('common.seat', { number: seatNumber(game, seatId) ?? '?' });
	const name = game.seats[seatId]?.playerName;
	return name ? t('common.seatWithName', { seat, name }) : seat;
}
