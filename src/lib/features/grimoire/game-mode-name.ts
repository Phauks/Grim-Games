/**
 * The name of the alternative game mode a game was started in and its special rules, joined
 * with " + ", or undefined for a standard game with none. Read through the game modes feature
 * (game-mode-store, findMode); shared by the board's corner title and the Resume and History
 * lists (Trevor, 2026-10-18).
 */
import { STANDARD } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from '#lib/features/modes/custom-modes.svelte.ts';
import { readGameMode } from '#lib/features/modes/game-mode-store.ts';

export function gameModeName(gameId: GameId): string | undefined {
	const names = gameModeNames(gameId);
	return names.length ? names.join(' + ') : undefined;
}

/**
 * The same names one by one: the mode first, if it isn't Standard, then each special rule.
 * The board's corner gives each its own line (Trevor, 2026-10-19).
 */
export function gameModeNames(gameId: GameId): string[] {
	const { mode, rules } = gameModeParts(gameId);
	return [...(mode ? [mode] : []), ...rules];
}

/** The mode's name, unless Standard, and the rules' names apart: the corner has an eye each. */
export function gameModeParts(gameId: GameId): { mode?: string; rules: string[] } {
	const record = readGameMode(gameId);
	if (!record) return { rules: [] };
	const mode = record.modeId !== STANDARD.id ? findMode(record.modeId)?.name : undefined;
	return { ...(mode ? { mode } : {}), rules: record.rules.map((r) => r.name) };
}
