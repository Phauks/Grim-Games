/**
 * Where a reminder token was before tonight (M89, Trevor 2026-11-19), read from the game's
 * log, so a night step can show last night's pick beside tonight's. Only shown, never placed
 * for the Storyteller.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { GameLog } from './log.ts';
import { appliedEntries } from './applied-entries.ts';

export interface LastPlaced {
	seatId: SeatId;
	/** `night`: on the board when the last day began; `day`: placed during that day. */
	when: 'night' | 'day';
}

/**
 * Where `characterId`'s `label` copies were before tonight, one per copy, oldest first:
 * each copy on the board just before the last New day (so a token that comes off at dawn,
 * the Monk's Safe, still counts), then copies first placed during that day, up to tonight's
 * Dusk. Without a Dusk the day's placements are left out, as tonight's would look the same.
 * None before the first New day.
 */
export function lastPlaced(log: GameLog, characterId: CharacterId, label: string): LastPlaced[] {
	const entries = appliedEntries(log);
	const dawn = entries.findLastIndex((e) => e.events.some((ev) => ev.type === 'DayStarted'));
	if (dawn < 0) return [];
	const dusk = entries.findLastIndex((e, i) => i > dawn && e.command === 'Dusk');

	const on = new Map<string, SeatId>();
	const out = new Map<string, LastPlaced>();
	for (let i = 0; i < (dusk < 0 ? dawn : dusk); i++) {
		if (i === dawn) for (const [id, seatId] of on) out.set(id, { seatId, when: 'night' });
		for (const ev of entries[i].events) {
			if (ev.type === 'ReminderAdded') {
				const r = ev.reminder;
				if (r.characterId !== characterId || r.label !== label) continue;
				on.set(r.reminderId, ev.seatId);
				if (i > dawn) out.set(r.reminderId, { seatId: ev.seatId, when: 'day' });
			} else if (ev.type === 'ReminderMoved' && on.has(ev.reminderId)) {
				on.set(ev.reminderId, ev.toSeatId);
				if (i > dawn && out.get(ev.reminderId)?.when === 'day')
					out.set(ev.reminderId, { seatId: ev.toSeatId, when: 'day' });
			} else if (
				ev.type === 'ReminderRemoved' ||
				ev.type === 'ReminderLoosened' ||
				ev.type === 'ReminderMovedToRuleCharacter'
			) {
				on.delete(ev.reminderId);
			}
		}
	}
	if (dusk < 0) for (const [id, seatId] of on) out.set(id, { seatId, when: 'night' });
	return [...out.values()];
}
