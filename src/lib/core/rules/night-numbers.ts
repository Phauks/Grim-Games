/**
 * Night order numbers counted among characters only (Trevor, 2026-10-17: "not including dawn
 * or traveler info, just relating to other characters"), for the badges on a token's side
 * leaves. Dusk, Dawn, Minion info, Demon info, the Travellers' alignment step, the
 * Storyteller's own steps and the announcements after Dawn get no number; a character that
 * wakes twice keeps its first number.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import { isNightMarker, type NightStep } from './night-order.ts';

/**
 * A game's night: its steps in order (`nightOrder`, as the board shows them). `counts` leaves
 * steps out, so the rest number 1, 2, 3 among themselves (Trevor, 2026-10-17: a dead
 * player's character drops out of the count).
 */
export function stepNightNumbers<S extends Pick<NightStep, 'kind' | 'character' | 'afterDawn'>>(
	steps: readonly S[],
	counts: (step: S) => boolean = () => true
): Map<CharacterId, number> {
	const out = new Map<CharacterId, number>();
	for (const step of steps) {
		if (step.kind !== 'character' || !step.character || step.afterDawn) continue;
		if (!counts(step)) continue;
		if (!out.has(step.character.id)) out.set(step.character.id, out.size + 1);
	}
	return out;
}

/** TPI's whole night sheet (every character), for pages that show no game, such as Reference. */
export function sheetNightNumbers(ids: readonly string[]): Map<CharacterId, number> {
	const out = new Map<CharacterId, number>();
	for (const id of ids) {
		if (isNightMarker(id) || out.has(id)) continue;
		out.set(id, out.size + 1);
	}
	return out;
}

/**
 * The seats that died since the last "New day" (the events applied so far, oldest first):
 * tonight is the night of their death, when an ability set off by dying (`ON_DEATH`, such as
 * the Ravenkeeper's) still wakes them.
 */
export function diedSinceNewDay(
	events: readonly { type: string; seatId?: SeatId; dead?: boolean }[]
): Set<SeatId> {
	const out = new Set<SeatId>();
	for (const event of events) {
		if (event.type === 'DayStarted') out.clear();
		else if (event.type === 'DeathSet' && event.seatId) {
			if (event.dead) out.add(event.seatId);
			else out.delete(event.seatId);
		}
	}
	return out;
}

/**
 * The seats brought back to life since the last "New day" (the events applied so far, oldest
 * first): revived tonight, as a player the Shabaloth regurgitates is.
 */
export function revivedSinceNewDay(
	events: readonly { type: string; seatId?: SeatId; dead?: boolean }[]
): Set<SeatId> {
	const out = new Set<SeatId>();
	for (const event of events) {
		if (event.type === 'DayStarted') out.clear();
		else if (event.type === 'DeathSet' && event.seatId) {
			if (event.dead) out.delete(event.seatId);
			else out.add(event.seatId);
		}
	}
	return out;
}
