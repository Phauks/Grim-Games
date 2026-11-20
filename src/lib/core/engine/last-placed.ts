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
	/**
	 * When it was there, numbered as the day view numbers them (`rules/game-phase.ts`): the
	 * night before the last New day, or that day itself.
	 */
	phase: { kind: 'night' | 'day'; number: number };
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
	/** Day N follows Night N: the last New day is day `number`. */
	const number = entries
		.slice(0, dawn + 1)
		.filter((e) => e.events.some((ev) => ev.type === 'DayStarted')).length;
	const night = { kind: 'night', number } as const;
	const day = { kind: 'day', number } as const;

	const on = new Map<string, SeatId>();
	const out = new Map<string, LastPlaced>();
	for (let i = 0; i < (dusk < 0 ? dawn : dusk); i++) {
		if (i === dawn) for (const [id, seatId] of on) out.set(id, { seatId, phase: night });
		for (const ev of entries[i].events) {
			if (ev.type === 'ReminderAdded') {
				const r = ev.reminder;
				if (r.characterId !== characterId || r.label !== label) continue;
				on.set(r.reminderId, ev.seatId);
				if (i > dawn) out.set(r.reminderId, { seatId: ev.seatId, phase: day });
			} else if (ev.type === 'ReminderMoved' && on.has(ev.reminderId)) {
				on.set(ev.reminderId, ev.toSeatId);
				if (i > dawn && out.get(ev.reminderId)?.phase === day)
					out.set(ev.reminderId, { seatId: ev.toSeatId, phase: day });
			} else if (
				ev.type === 'ReminderRemoved' ||
				ev.type === 'ReminderLoosened' ||
				ev.type === 'ReminderMovedToRuleCharacter'
			) {
				on.delete(ev.reminderId);
			}
		}
	}
	if (dusk < 0) for (const [id, seatId] of on) out.set(id, { seatId, phase: night });
	return [...out.values()];
}

/** Where a token was put, and in which night or day (`tokenHistory`). */
export interface TokenPlacement {
	seatId: SeatId;
	phase: { kind: 'night' | 'day'; number: number };
}

/**
 * Every seat `characterId`'s `label` token was put on, oldest first, each with the night or
 * day it happened in (M89, Trevor 2026-11-19: tap last night to see that token's history).
 * Night 1 runs until the first New day; Day N from the Nth New day until a Dusk, then Night
 * N+1. A night whose Dusk changed nothing leaves no Dusk in the log, so its placements count
 * as the day before. The same seat twice in one night or day is listed once.
 */
export function tokenHistory(
	log: GameLog,
	characterId: CharacterId,
	label: string
): TokenPlacement[] {
	const out: TokenPlacement[] = [];
	const ids = new Set<string>();
	let days = 0;
	let night = true;
	for (const entry of appliedEntries(log)) {
		if (entry.command === 'Dusk') night = true;
		for (const ev of entry.events) {
			if (ev.type === 'DayStarted') {
				days += 1;
				night = false;
			}
			let seatId: SeatId | undefined;
			if (
				ev.type === 'ReminderAdded' &&
				ev.reminder.characterId === characterId &&
				ev.reminder.label === label
			) {
				ids.add(ev.reminder.reminderId);
				seatId = ev.seatId;
			} else if (ev.type === 'ReminderMoved' && ids.has(ev.reminderId)) seatId = ev.toSeatId;
			if (seatId === undefined) continue;
			const phase = night
				? { kind: 'night' as const, number: days + 1 }
				: { kind: 'day' as const, number: days };
			const same = out.some(
				(p) => p.seatId === seatId && p.phase.kind === phase.kind && p.phase.number === phase.number
			);
			if (!same) out.push({ seatId, phase });
		}
	}
	return out;
}
