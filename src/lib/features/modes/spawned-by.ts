import { STANDARD, type GameMode, type SpecialRule } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

/**
 * The game's mode and special rules that set a part, so a screen one of them opens can show
 * them at its top (Trevor, 2026-10-23: "always show the associated rule that spawned the
 * screen"). The mode counts only when it isn't Standard; rules keep the order chosen.
 */
export function spawnedBy(
	gameId: GameId,
	has: (parts: GameMode['parts'] | SpecialRule['parts']) => boolean
): (GameMode | SpecialRule)[] {
	const record = readGameMode(gameId);
	if (!record) return [];
	const mode = findMode(record.modeId);
	return [
		...(mode && mode.id !== STANDARD.id && has(mode.parts) ? [mode] : []),
		...record.rules.filter((rule) => has(rule.parts))
	];
}
