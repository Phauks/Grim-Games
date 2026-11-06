/**
 * New day: today's log closes into the past days and a fresh one starts. A note written
 * overnight for the new day (the Savant's information, set before Dawn: Trevor, 2026-11-06)
 * starts the new day's log instead.
 */
import type { DayEntry, Game } from '#lib/core/model/index.ts';

type Note = Extract<DayEntry, { kind: 'note' }>;

export function startDay(game: Game, at: number): Game {
	const isAhead = (e: DayEntry): e is Note => e.kind === 'note' && !!e.forComingDay;
	const ahead = game.today.entries.filter(isAhead);
	const ended = ahead.length
		? { ...game.today, entries: game.today.entries.filter((e) => !isAhead(e)) }
		: game.today;
	return {
		...game,
		today: {
			entries: ahead.map((note) => {
				const kept: Note = { ...note };
				delete kept.forComingDay;
				return kept;
			})
		},
		pastDays: [...game.pastDays, { ...ended, closedAt: at }]
	};
}
