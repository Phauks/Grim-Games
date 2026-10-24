/**
 * How a seat is named. One helper for the board's alerts, confirmations and seat sheet
 * (component review, 2026-10-18: three copies, all in English).
 */
import { seatNumber, type Game, type SeatId } from '#lib/core/model/index.ts';
import type { PlayerName } from '#lib/core/data/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/**
 * What a seat's PlayerBadge says, the same as the pill under its token on the board: the
 * player's name, or "Seat 3" with none (Trevor, 2026-10-19: one name badge for every seat).
 */
export function seatName(game: Game, seatId: SeatId): PlayerName {
	return (
		game.seats[seatId]?.playerName ?? t('common.seat', { number: seatNumber(game, seatId) ?? '?' })
	);
}

/**
 * "Seat 3 (Alex)", or "Seat 3" with no player name: for plain-text places only, such as
 * accessible names and a native list's options. On screen a seat is a PlayerBadge
 * (`seatName`), which the `grim/names-as-badges` lint checks.
 */
export function seatLabel(game: Game, seatId: SeatId): PlayerName {
	const seat = t('common.seat', { number: seatNumber(game, seatId) ?? '?' });
	const name = game.seats[seatId]?.playerName;
	// eslint-disable-next-line grim/names-as-badges -- the plain-text form, itself marked
	return name ? t('common.seatWithName', { seat, name }) : seat;
}
