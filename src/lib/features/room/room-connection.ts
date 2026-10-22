/**
 * One connection per room on this phone, shared by everything that shows it: /play's Room
 * and Grim tabs, and the Join game page. The socket closes when the last of them lets go.
 */
import { RoomPlayer } from './player.svelte.ts';

const open = new Map<string, { player: RoomPlayer; users: number }>();

/** A tab or page that lets go and is replaced at once (Room to Grim) keeps the same socket. */
const LINGER_MS = 1000;

export function useRoom(code: string): RoomPlayer {
	const entry = open.get(code) ?? { player: new RoomPlayer(code), users: 0 };
	entry.users++;
	open.set(code, entry);
	return entry.player;
}

export function releaseRoom(player: RoomPlayer): void {
	const entry = open.get(player.code);
	if (!entry || entry.player !== player) return;
	if (--entry.users > 0) return;
	setTimeout(() => {
		if (entry.users > 0 || open.get(player.code) !== entry) return;
		open.delete(player.code);
		player.stop();
	}, LINGER_MS);
}
