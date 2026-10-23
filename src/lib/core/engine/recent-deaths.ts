/**
 * Who died in the night, from the game's log, so the Storyteller announces every death at
 * dawn (Trevor, 2026-10-16: "add the names ... of the people who died, so the Storyteller
 * doesn't forget"). Deaths during the day are not announcements (Trevor, 2026-10-18:
 * "announcements is meant for things that happen at night that should be announced at dawn").
 *
 * The boundaries come from the log:
 * - the night starts after the previous day's last execution or exile (that death was
 *   public), or at that day's New day if it had none, or at the start of the game;
 * - it ends at the most recent New day (dawn); before any New day, the whole game so far.
 * Executions and exiles are always day deaths, so they are never listed.
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
	const entries = lastNight(log);
	const deaths = new Map<SeatId, RecentDeath>();
	for (const entry of entries) {
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
	return [...deaths.values()].filter(
		(d) => game.seats[d.seatId]?.dead === true && d.cause !== 'execution' && d.cause !== 'exile'
	);
}

/** The log entries of the night just ended, with the boundaries described above. */
function lastNight(log: GameLog): GameLog['entries'] {
	const entries = log.entries.slice(0, log.cursor);
	const dayStarts = entries.flatMap((e, i) =>
		e.events.some((ev) => ev.type === 'DayStarted') ? [i] : []
	);
	let from = 0;
	let to = entries.length;
	if (dayStarts.length > 0) {
		const latest = dayStarts[dayStarts.length - 1];
		const previous = dayStarts.length > 1 ? dayStarts[dayStarts.length - 2] : 0;
		from = previous;
		to = latest + 1;
		for (let i = previous; i < latest; i++) {
			const ended = entries[i].events.some(
				(ev) =>
					ev.type === 'DayEntryAdded' &&
					(ev.entry.kind === 'execution' || ev.entry.kind === 'exile')
			);
			if (ended) from = i + 1;
		}
	}
	return entries.slice(from, to);
}

/**
 * Who came back to life in the night just ended (Trevor, 2026-10-20: "announcements must
 * include people being revived"): players dead when it began and alive now, in the order
 * they were revived. Someone who died and was revived the same night is in neither list.
 */
export function recentRevivals(log: GameLog, game: Game): SeatId[] {
	const seen: SeatId[] = [];
	const revived: SeatId[] = [];
	for (const entry of lastNight(log)) {
		for (const event of entry.events) {
			if (event.type !== 'DeathSet' || seen.includes(event.seatId)) continue;
			seen.push(event.seatId);
			// The seat's first change this night brought it back, so it was dead before.
			if (!event.dead) revived.push(event.seatId);
		}
	}
	return revived.filter((seatId) => game.seats[seatId]?.dead === false);
}
