/**
 * A Public Town display (Trevor, 2026-10-26): a tablet in the middle of the table that shows
 * the town as everyone there knows it, and nothing else. It joins with the room's code alone,
 * as a phone does, but is no member: it sends nothing, and the room sends it only the public
 * table and the script (`TownView`).
 */
import type { Script } from '#lib/core/data/index.ts';
import { ROOM_PROTOCOL, type TownView } from '#lib/core/sync/room.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';

export class RoomTown {
	view = $state.raw<TownView>();
	/** The game's script, once the Storyteller's device has sent it. */
	script = $state.raw<Script>();
	readonly #socket: RoomSocket;

	constructor(code: string) {
		this.#socket = new RoomSocket(
			code,
			// The room ignores a display's key; a hello still carries one.
			{ type: 'hello', role: 'town', key: randomKey(), protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'town-view') this.view = m;
				else if (m.type === 'script') this.script = m.script;
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
