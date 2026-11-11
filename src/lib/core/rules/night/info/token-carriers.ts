/**
 * Players marked by a waking character's own reminder token, for its information: the Fortune
 * Teller's red herring, the Balloonist's last shown player.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { getSeat } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/** Whether a seat carries the character's `token` reminder (the Fortune Teller's red herring). */
export function carries(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	token: string | undefined
): boolean {
	return (getSeat(game, seatId)?.reminders ?? []).some(
		(r) => r.characterId === characterId && r.label === token
	);
}

/**
 * The players last shown to a waking player, by the `token` placed on them: the carriers of
 * the token its latest recorded info placed, or else every carrier of the token.
 */
export function lastShown(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	token: string | undefined
): SeatId[] {
	const carriers = game.seating.filter((s) => carries(game, s, characterId, token));
	const entries = [...game.pastDays.flatMap((d) => d.entries), ...game.today.entries];
	for (const e of entries.reverse()) {
		if (e.kind !== 'info' || e.seatId !== seatId || e.characterId !== characterId) continue;
		const placed = carriers.filter((s) =>
			game.seats[s].reminders.some((r) => e.reminderIds.includes(r.reminderId))
		);
		if (placed.length > 0) return placed;
	}
	return carriers;
}
