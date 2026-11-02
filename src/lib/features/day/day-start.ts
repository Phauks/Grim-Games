import type { Game } from '#lib/core/model/index.ts';

/**
 * The reminders as the day started: tokens placed by today's ability uses are left out,
 * so "has an unused shot" stays put (with Used pressed) instead of vanishing mid-day.
 */
export function atDayStart(game: Game): Game {
	const placed = new Set(
		game.today.entries.flatMap((e) => (e.kind === 'ability' && e.reminderId ? [e.reminderId] : []))
	);
	if (placed.size === 0) return game;
	const seats = Object.fromEntries(
		Object.entries(game.seats).map(([id, seat]) => [
			id,
			{ ...seat, reminders: seat.reminders.filter((r) => !placed.has(r.reminderId)) }
		])
	);
	return { ...game, seats };
}
