/**
 * A viewer of the view-only grimoire link (Specters, Trevor 2026-10-18): it sees the
 * Storyteller's whole grimoire, live, and sends nothing back. The link's key comes from the
 * URL's hash, which never reaches the server, and is sent only in the socket's hello.
 */
import { ROOM_PROTOCOL, type SharedGrimoire } from '#lib/core/sync/room.ts';
import { RoomSocket } from './room-socket.svelte.ts';

/** The link's key, as the Storyteller's device makes it (`randomKey`). */
export function viewerKeyFrom(hash: string): string | undefined {
	const key = hash.replace(/^#/, '');
	return /^[0-9a-f]{64}$/.test(key) ? key : undefined;
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
