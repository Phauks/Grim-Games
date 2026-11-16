/**
 * One connection per room on this phone, shared by everything that shows it: /play's Room
 * and Grim tabs, and the Join game page. The socket closes when the last of them lets go.
 */
import { ROOM_PROTOCOL } from '#lib/core/sync/room.ts';
import { deviceKey, forgetRoom, RoomPlayer } from './player.svelte.ts';
import { RoomSocket } from './room-socket.svelte.ts';

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

/** How long leaving waits for a room this phone isn't connected to before giving up. */
const LEAVE_WAIT_MS = 8000;

/**
 * Leaves room `code` for good (Trevor, 2026-11-16: "a way to leave the game if they don't want
 * to be in it", so they don't stay on as a spectator): the room drops this phone, its seat
 * and its vote, and the phone forgets the room. Its code joins it again as a new phone.
 * Resolves false when the room couldn't be reached; the phone forgets it all the same.
 */
export async function leaveRoom(code: string): Promise<boolean> {
	const entry = open.get(code);
	let left = !!entry?.player.leave();
	if (!left) left = await leaveFromAfar(code);
	if (entry && open.get(code) === entry) {
		open.delete(code);
		entry.player.stop();
	}
	forgetRoom(code);
	return left;
}

/** Says hello to the room only to leave it, from a screen with no connection to it. */
function leaveFromAfar(code: string): Promise<boolean> {
	return new Promise((resolve) => {
		let socket: RoomSocket | undefined = undefined;
		const done = (left: boolean) => {
			clearTimeout(timer);
			socket?.stop();
			resolve(left);
		};
		const timer = setTimeout(() => done(false), LEAVE_WAIT_MS);
		socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'player', key: deviceKey(), protocol: ROOM_PROTOCOL },
			// Turned away (the room closed, or removed this phone): nothing to leave.
			(message) => {
				if (message.type === 'refused' || message.type === 'closed') done(true);
			},
			() => done(!!socket?.send({ type: 'leave' }))
		);
	});
}
