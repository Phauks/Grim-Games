/**
 * A viewer of the view-only grimoire link (Specters, Trevor 2026-10-18): it sees the
 * Storyteller's whole grimoire, live, and sends nothing back. The link's key comes from the
 * URL's hash, which never reaches the server, and is sent only in the socket's hello.
 */
import { ROOM_PROTOCOL, type SharedGrimoire } from '#lib/core/sync/room.ts';
import { RoomSocket, sha256Hex } from './room-socket.svelte.ts';

/** The link's key, as the Storyteller's device makes it (`randomKey`). */
export function viewerKeyFrom(hash: string): string | undefined {
	const key = hash.replace(/^#/, '');
	return /^[0-9a-f]{64}$/.test(key) ? key : undefined;
}

/**
 * The view-only link's key made from a Grim view password (plan D1: "grim view by password
 * or direct link"), so a phone with the room code and the password opens the same grimoire
 * as the link. The code is part of it, so one password makes a different key in each room.
 */
export function viewerKeyFromPassword(code: string, password: string): Promise<string> {
	return sha256Hex(`grim-games:grim-view:${code}:${password.trim()}`);
}

export class RoomViewer {
	/** The grimoire, once the Storyteller's device has sent it. */
	grimoire = $state.raw<SharedGrimoire>();
	readonly #socket: RoomSocket;

	constructor(code: string, key: string) {
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'viewer', key, protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'grimoire') this.grimoire = m.grimoire;
			}
		);
	}

	get status() {
		return this.#socket.status;
	}

	get refusedReason() {
		return this.#socket.refusedReason;
	}

	stop(): void {
		this.#socket.stop();
	}
}
