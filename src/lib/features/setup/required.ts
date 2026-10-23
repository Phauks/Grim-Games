/**
 * Characters a game's mode or special rules require in the bag (Trevor, 2026-10-22: "do not
 * allow for that character to be unselected"), each with the name of what requires it.
 * Read from the mode's `forced.inPlay`, or a town's `towns.inPlay` (`inPlayFor`), so a rule
 * that sets either is picked up here with no change.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { inPlayFor, STANDARD } from '#lib/core/modes/index.ts';
import { findMode } from '#lib/features/modes/custom-modes.svelte.ts';
import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
import { townGroupOf } from '#lib/features/modes/town-groups.ts';

export function requiredInBag(gameId: GameId): Map<CharacterId, string> {
	const out = new Map<CharacterId, string>();
	const group = townGroupOf(gameId);
	if (group) {
		const mode = findMode(group.modeId) ?? STANDARD;
		for (const id of inPlayFor(mode, group.gameIds.indexOf(gameId))) out.set(id, mode.name);
		return out;
	}
	const record = readGameMode(gameId);
	if (!record) return out;
	const mode = findMode(record.modeId) ?? STANDARD;
	for (const id of inPlayFor(mode)) out.set(id, mode.name);
	for (const rule of record.rules) {
		for (const id of rule.parts.forced?.inPlay ?? []) if (!out.has(id)) out.set(id, rule.name);
	}
	return out;
}
