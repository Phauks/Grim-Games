/**
 * Night order numbers counted among characters only (Trevor, 2026-10-17: "not including dawn
 * or traveler info, just relating to other characters"), for the badges on a token's side
 * leaves. Dusk, Dawn, Minion info, Demon info, the Travellers' alignment step, the
 * Storyteller's own steps and the announcements after Dawn get no number; a character that
 * wakes twice keeps its first number.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { isNightMarker, type NightStep } from './night-order.ts';

/** A game's night: its steps in order (`nightOrder`, as the board shows them). */
export function stepNightNumbers(
	steps: readonly Pick<NightStep, 'kind' | 'character' | 'afterDawn'>[]
): Map<CharacterId, number> {
	const out = new Map<CharacterId, number>();
	for (const step of steps) {
		if (step.kind !== 'character' || !step.character || step.afterDawn) continue;
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
