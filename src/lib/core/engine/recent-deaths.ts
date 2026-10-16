/**
 * Who has died since the previous day ended, from the game's log, so the Storyteller can
 * announce every death (Trevor, 2026-10-16: "add the names ... of the people who died, so
 * the Storyteller doesn't forget").
 *
 * The app does not track day and night, so the boundary comes from the log:
 * - the window starts after the previous day's last execution or exile (that death was
 *   public), or at that day's New day if it had none, or at the start of the game;
 * - "the previous day" is the one before the most recent New day. Before any New day, the
 *   whole game counts.
 * So whether the Storyteller taps New day at dawn or not yet, last night's deaths are in it.
 *
 * Only players still dead are listed, in the order they died, with their latest cause.
 */
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import type { GameLog } from './log.ts';

export interface RecentDeath {
	seatId: SeatId;
	cause?: DeathCause;
}

export function recentDeaths(log: GameLog, game: Game): RecentDeath[] {
	const entries = log.entries.slice(0, log.cursor);
	const dayStarts = entries.flatMap((e, i) =>
		e.events.some((ev) => ev.type === 'DayStarted') ? [i] : []
	);
	let from = 0;
	if (dayStarts.length > 0) {
		const latest = dayStarts[dayStarts.length - 1];
		const previous = dayStarts.length > 1 ? dayStarts[dayStarts.length - 2] : 0;
		from = previous;
		for (let i = previous; i < latest; i++) {
			const ended = entries[i].events.some(
				(ev) =>
					ev.type === 'DayEntryAdded' &&
					(ev.entry.kind === 'execution' || ev.entry.kind === 'exile')
			);
			if (ended) from = i + 1;
		}
	}

	const deaths = new Map<SeatId, RecentDeath>();
	for (const entry of entries.slice(from)) {
		for (const event of entry.events) {
			if (event.type === 'DeathSet') {
				deaths.delete(event.seatId);
				if (event.dead) {
					deaths.set(event.seatId, {
						seatId: event.seatId,
						...(event.cause ? { cause: event.cause } : {})
					});
				}
			} else if (event.type === 'DeathCauseSet') {
				const death = deaths.get(event.seatId);
				if (death) {
					deaths.set(event.seatId, {
						seatId: event.seatId,
						...(event.cause ? { cause: event.cause } : {})
					});
				}
			}
		}
	}
	return [...deaths.values()].filter((d) => game.seats[d.seatId]?.dead === true);
}
