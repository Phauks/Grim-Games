/**
 * A Public Town display (Trevor, 2026-10-26): a tablet in the middle of the table that shows
 * the town as everyone there knows it, and nothing else. It joins with the room's code alone,
 * as a phone does, but is no member: it sends nothing, and the room sends it only the public
 * table and the script (`TownView`).
 *
 * An admin watching from Live games (plan J31) uses the same view over the admins' route,
 * unseen, and also gets the whole grimoire while the room has it.
 */
import type { Script } from '#lib/core/data/index.ts';
import { liveGamePath } from '#lib/core/sync/live-games.ts';
import {
	parseTownSound,
	ROOM_PROTOCOL,
	type SharedGrimoire,
	type TownSoundCommand,
	type TownView
} from '#lib/core/sync/room.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';

export class RoomTown {
	view = $state.raw<TownView>();
	/** The game's script, once the Storyteller's device has sent it. */
	script = $state.raw<Script>();
	/** An admin's only: the whole grimoire, while the room has it. */
	grimoire = $state.raw<SharedGrimoire>();
	/** The finished grimoire the Storyteller shared at game end (plan R5), as phones get it. */
	revealed = $state.raw<{ gameId: string; grimoire: SharedGrimoire }>();
	readonly #socket: RoomSocket;

	/**
	 * Called with each soundboard command the Storyteller sends the Public Town (plan U10);
	 * never for an admin watching.
	 */
	onSound: ((command: TownSoundCommand) => void) | undefined;

	constructor(code: string, admin = false) {
		this.#socket = new RoomSocket(
			code,
			// The room ignores a display's key; a hello still carries one.
			{ type: 'hello', role: 'town', key: randomKey(), protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'town-view') {
					this.view = m;
					// The game runs again, or a new one began: the finished grimoire goes.
					if (!m.ended) this.revealed = undefined;
				} else if (m.type === 'reveal') {
					this.revealed = { gameId: m.gameId, grimoire: m.grimoire };
				} else if (m.type === 'script') this.script = m.script;
				else if (m.type === 'grimoire' && admin) this.grimoire = m.grimoire;
				else if (m.type === 'town-sound' && !admin) {
					const command = parseTownSound(m);
					if (command) this.onSound?.(command);
				}
			},
			// Each connection starts again from what the room holds then.
			() => (this.grimoire = undefined),
			admin ? liveGamePath(code) : undefined
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
