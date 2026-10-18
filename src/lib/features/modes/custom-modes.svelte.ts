/**
 * Game modes people add themselves (Trevor, 2026-10-17: every part of a mode can be
 * inspected "to make it easier for ppl to add their own"): a mode file pasted or uploaded
 * on New game, checked with parseGameMode and kept on this device. The key carries a
 * version; a stored mode that no longer reads is dropped, never half-used.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { GAME_MODES, gameModeById, parseGameMode, type GameMode } from '#lib/core/modes/index.ts';

const KEY = 'grim-games:custom-modes:v1';

function read(): GameMode[] {
	const raw = readStored(KEY);
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((m) => {
		const parsed = parseGameMode(m);
		return parsed.ok && !gameModeById(parsed.mode.id) ? [parsed.mode] : [];
	});
}

let list = $state.raw<GameMode[]>(read());

function write(next: GameMode[]) {
	list = next;
	// Storage blocked: the mode stays for this visit only.
	writeStored(KEY, next);
}

export const customModes = {
	get list(): readonly GameMode[] {
		return list;
	},
	/** Checks a mode file and saves it, replacing one of the same id. */
	add(
		text: string,
		known?: ReadonlySet<CharacterId>
	): { ok: true; mode: GameMode } | { ok: false; issues: string[] } {
		let value: unknown;
		try {
			value = JSON.parse(text);
		} catch (e) {
			return { ok: false, issues: [`(file): ${e instanceof Error ? e.message : 'not JSON'}`] };
		}
		const parsed = parseGameMode(value, known);
		if (!parsed.ok) return parsed;
		if (gameModeById(parsed.mode.id))
			return { ok: false, issues: ['id: is a built-in mode; give your mode its own id'] };
		write([...list.filter((m) => m.id !== parsed.mode.id), parsed.mode]);
		return parsed;
	},
	remove(id: string): void {
		write(list.filter((m) => m.id !== id));
	}
};

/** A built-in mode, or one added on this device. */
export function findMode(id: string): GameMode | undefined {
	return gameModeById(id) ?? list.find((m) => m.id === id);
}

/** Built-in modes then this device's own, for the Game modes tab. */
export function allModes(): readonly GameMode[] {
	return [...GAME_MODES, ...list];
}
