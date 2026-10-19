/**
 * A player's phone in a live room (07-accounts-and-multi-device.md §4.2): it sees the
 * public table and asks the Storyteller for a name and a seat. The phone's key is its own
 * secret, kept on the device, so it is the same member when it comes back.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { ROOM_PROTOCOL, type PlayerView } from '#lib/core/sync/room.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';

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

/** The room this phone last joined, so /play's Room tab opens it again (Trevor, 2026-10-19). */
const LAST_ROOM_KEY = 'grim-games-room-last';

export function lastRoom(): string | undefined {
	return readStoredText(LAST_ROOM_KEY);
}

/** Forgets the last room when it is `code` (it closed, or refused this phone). */
export function forgetRoom(code: string): void {
	if (lastRoom() === code) writeStoredText(LAST_ROOM_KEY, undefined);
}

export class RoomPlayer {
	view = $state.raw<PlayerView>();
	/** The game's script, once the Storyteller's device has sent it. */
	script = $state.raw<Script>();
	readonly code: string;
	readonly #socket: RoomSocket;

	constructor(code: string) {
		this.code = code;
		writeStoredText(LAST_ROOM_KEY, code);
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'player', key: deviceKey(), protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'player-view') this.view = m;
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

	/** A spectator's choice in the open vote (Specters); a new choice replaces the last. */
	vote(choice: SeatId): boolean {
		const voteId = this.view?.vote?.voteId;
		return voteId ? this.#socket.send({ type: 'vote', voteId, choice }) : false;
	}

	stop(): void {
		this.#socket.stop();
	}
}
