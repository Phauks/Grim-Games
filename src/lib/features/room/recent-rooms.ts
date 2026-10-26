/**
 * The live rooms this phone joined (Trevor, 2026-10-19: the Join screen shows "recently
 * played or active games that I entered"), newest first, kept on the device only. A room
 * leaves the list once it is found closed.
 */
import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:room-recent';
export const MAX_RECENT_ROOMS = 5;

export interface RecentRoom {
	code: string;
	/** The game's script name, once the room sent it. */
	script?: string;
	/** Milliseconds since the epoch, when this phone last opened it. */
	at: number;
	/**
	 * Last opened as a Public Town display, so it opens that way again (Trevor, 2026-10-26:
	 * "shouldn't it reopen to that mode").
	 */
	town?: true;
}

export function parseRecentRooms(raw: unknown): RecentRoom[] {
	if (!Array.isArray(raw)) return [];
	const rooms: RecentRoom[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const { code, script, at, town } = item as Record<string, unknown>;
		const valid = typeof code === 'string' ? normaliseRoomCode(code) : null;
		if (!valid || typeof at !== 'number' || rooms.some((r) => r.code === valid)) continue;
		rooms.push({
			code: valid,
			...(typeof script === 'string' ? { script } : {}),
			at,
			...(town === true ? { town } : {})
		});
	}
	return rooms.slice(0, MAX_RECENT_ROOMS);
}

/**
 * `room` first, keeping its script name when this visit has none yet. The way it was opened
 * is this visit's: joining as a player after a Public Town visit opens it as a player next.
 */
export function withRecentRoom(rooms: RecentRoom[], room: RecentRoom): RecentRoom[] {
	const old = rooms.find((r) => r.code === room.code);
	const script = room.script ?? old?.script;
	return [
		{
			code: room.code,
			...(script !== undefined ? { script } : {}),
			at: room.at,
			...(room.town ? { town: true as const } : {})
		},
		...rooms.filter((r) => r.code !== room.code)
	].slice(0, MAX_RECENT_ROOMS);
}

export function recentRooms(): RecentRoom[] {
	return parseRecentRooms(readStored(KEY));
}

/** `town`: opened as a Public Town display rather than joined as a player. */
export function rememberRoom(code: string, script?: string, town = false): void {
	writeStored(
		KEY,
		withRecentRoom(recentRooms(), { code, script, at: Date.now(), ...(town ? { town } : {}) })
	);
}

export function forgetRecentRoom(code: string): void {
	writeStored(
		KEY,
		recentRooms().filter((r) => r.code !== code)
	);
}
