/**
 * Every pick a reminder token marked, in the order it was made, read from the game's log
 * (M90, Trevor 2026-11-19): what a rule that compares a choice with an earlier one reads,
 * such as a pick that must differ from the previous one (the Balloonist's), from last
 * night's (the Devil's Advocate's) or from every earlier one (the Bounty Hunter's). The log
 * keeps the order, so one token that moves each night and two copies left on the board read
 * the same. Entries after the cursor (undone) are left out.
 */
import type { Game, Reminder, ReminderId, SeatId } from '#lib/core/model/types.ts';
import type { PastPicks, Pick } from '#lib/core/model/picks.ts';
import type { GameLog } from './log.ts';
import { applyEvents } from './reducer.ts';
import { appliedEntries } from './applied-entries.ts';

/**
 * The picks made before tonight. A pick is a token placed on a seat, or moved to one; a copy
 * moved again the same night counts once, where it ended up, so a correction is not a second
 * pick.
 */
export function pickHistory(log: GameLog): PastPicks {
	const tokens = new Map<ReminderId, Reminder>();
	const picks: Pick[] = [];
	let game: Game | undefined;
	let night = 1;
	for (const entry of appliedEntries(log)) {
		game = applyEvents(game, entry.events);
		for (const ev of entry.events) {
			let pick: { reminderId: ReminderId; seatId: SeatId } | undefined;
			if (ev.type === 'DayStarted') night += 1;
			else if (ev.type === 'ReminderAdded') {
				tokens.set(ev.reminder.reminderId, ev.reminder);
				pick = { reminderId: ev.reminder.reminderId, seatId: ev.seatId };
			} else if (ev.type === 'ReminderMoved' && tokens.has(ev.reminderId)) {
				pick = { reminderId: ev.reminderId, seatId: ev.toSeatId };
			}
			if (!pick || !game) continue;
			const id = pick.reminderId;
			const again = picks.findIndex((p) => p.reminderId === id && p.night === night);
			if (again >= 0) picks.splice(again, 1);
			picks.push({ ...pick, night, game });
		}
	}
	const tonight = night;
	const past = picks.filter((p) => p.night < tonight);
	return {
		tonight,
		of(reminder) {
			return past.filter((p) => {
				const token = tokens.get(p.reminderId);
				return (
					token?.characterId === reminder.characterId &&
					token.label === reminder.label &&
					(reminder.ownerSeatId === undefined || token.ownerSeatId === reminder.ownerSeatId)
				);
			});
		}
	};
}
