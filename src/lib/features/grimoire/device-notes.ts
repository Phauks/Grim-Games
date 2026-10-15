/**
 * Small things the grimoire keeps on this device, outside the game's event log:
 * - player names used before, offered as suggestions when naming a seat;
 * - which tokens the Storyteller turned upside down. In the physical grimoire that is only
 *   a reminder to the Storyteller with no rules meaning, so it is not game state.
 *
 * Both live in localStorage with a version in the key, and anything unreadable is ignored.
 */
import type { GameId, SeatId } from '#lib/core/model/index.ts';

const NAMES_KEY = 'grim-games:player-names:v1';
const FLIPPED_KEY = (gameId: GameId) => `grim-games:upside-down:v1:${gameId}`;
/** How many past names are remembered. */
export const MAX_NAMES = 60;

function readList(key: string): string[] {
	try {
		const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
		return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

function writeList(key: string, list: readonly string[]): void {
	try {
		if (list.length === 0) globalThis.localStorage?.removeItem(key);
		else globalThis.localStorage?.setItem(key, JSON.stringify(list));
	} catch {
		// Storage full or blocked: suggestions are a convenience.
	}
}

/** Adds a name to the front of a recent-names list (case-insensitive, no duplicates). */
export function rememberName(list: readonly string[], name: string): string[] {
	const trimmed = name.trim();
	if (!trimmed) return [...list];
	const key = trimmed.toLocaleLowerCase();
	return [trimmed, ...list.filter((n) => n.toLocaleLowerCase() !== key)].slice(0, MAX_NAMES);
}

/**
 * Names to suggest while typing: past names starting with what is typed (then containing
 * it), leaving out names already on another seat.
 */
export function suggestNames(
	list: readonly string[],
	typed: string,
	taken: readonly string[],
	limit = 6
): string[] {
	const query = typed.trim().toLocaleLowerCase();
	const used = new Set(taken.map((n) => n.toLocaleLowerCase()));
	const open = list.filter(
		(n) => !used.has(n.toLocaleLowerCase()) && n.toLocaleLowerCase() !== query
	);
	const starts = open.filter((n) => n.toLocaleLowerCase().startsWith(query));
	const contains = query
		? open.filter((n) => !starts.includes(n) && n.toLocaleLowerCase().includes(query))
		: [];
	return [...starts, ...contains].slice(0, limit);
}

export const pastNames = {
	read: (): string[] => readList(NAMES_KEY),
	remember(name: string): void {
		writeList(NAMES_KEY, rememberName(readList(NAMES_KEY), name));
	}
};

export const upsideDown = {
	read: (gameId: GameId): SeatId[] => readList(FLIPPED_KEY(gameId)),
	write: (gameId: GameId, seatIds: readonly SeatId[]): void =>
		writeList(FLIPPED_KEY(gameId), seatIds),
	forget: (gameId: GameId): void => writeList(FLIPPED_KEY(gameId), [])
};
