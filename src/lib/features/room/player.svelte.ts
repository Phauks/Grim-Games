/**
 * A player's phone in a live room (07-accounts-and-multi-device.md §4.2): it sees the
 * public table and asks the Storyteller for a name and a seat. The phone's key is its own
 * secret, kept on the device, so it is the same member when it comes back.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { PlayerView } from '#lib/core/sync/room.ts';
import { randomKey, readStored, RoomSocket, writeStored } from './room-socket.svelte.ts';

const STORAGE_KEY = 'grim-games-room-player';

function deviceKey(): string {
	const stored = readStored<{ key: string }>(STORAGE_KEY);
	if (stored?.key) return stored.key;
	const key = randomKey();
	writeStored(STORAGE_KEY, { key });
	return key;
}

/** The last name this phone asked for, to fill the field next time. */
const NAME_KEY = 'grim-games-room-name';

export class RoomPlayer {
	view = $state.raw<PlayerView>();
	readonly code: string;
	readonly #socket: RoomSocket;

	constructor(code: string) {
		this.code = code;
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'player', key: deviceKey() },
			(m) => {
				if (m.type === 'player-view') this.view = m;
			}
		);
	}

	get status() {
		return this.#socket.status;
	}

	get savedName(): string {
		return readStored<string>(NAME_KEY) ?? '';
	}

	/** Asks to sit in `seatId` (or anywhere) as `name`; replaces an earlier request. */
	ask(name: string, seatId?: SeatId): boolean {
		writeStored(NAME_KEY, name);
		return this.#socket.send(
			seatId ? { type: 'request', name, seatId } : { type: 'request', name }
		);
	}

	cancel(): void {
		this.#socket.send({ type: 'cancel-request' });
	}

	leaveSeat(): void {
		this.#socket.send({ type: 'leave-seat' });
	}

	stop(): void {
		this.#socket.stop();
	}
}
