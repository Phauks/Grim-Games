/**
 * Games played as towns of one mode game (Two Towns and a Boomdandy, Two games at once):
 * each town is an ordinary saved game, and this record, kept on the device, ties them
 * together. Versioned key; anything unreadable is dropped.
 */
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export interface TownGroup {
	groupId: string;
	modeId: string;
	/** One game per town, in town order. */
	gameIds: GameId[];
	createdAt: number;
}

const KEY = 'grim-games:town-groups:v1';

function readAll(): TownGroup[] {
	const raw = readStored(KEY);
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(g): g is TownGroup =>
			typeof g === 'object' &&
			g !== null &&
			typeof g.groupId === 'string' &&
			typeof g.modeId === 'string' &&
			Array.isArray(g.gameIds) &&
			g.gameIds.every((id: unknown) => typeof id === 'string')
	);
}

export function saveTownGroup(group: TownGroup): void {
	// Storage blocked: each town is still a saved game of its own.
	const others = readAll().filter((g) => g.groupId !== group.groupId);
	writeStored(KEY, [...others, group]);
}

export function townGroup(groupId: string): TownGroup | undefined {
	return readAll().find((g) => g.groupId === groupId);
}

/** The group a game is a town of, for a link back from its board. */
export function townGroupOf(gameId: GameId): TownGroup | undefined {
	return readAll().find((g) => g.gameIds.includes(gameId));
}
