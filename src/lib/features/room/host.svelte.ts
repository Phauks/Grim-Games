/**
 * The Storyteller's side of a live room (07-accounts-and-multi-device.md §4.2). The room
 * belongs to this device, not to a game: its code and host key are kept here, so the same
 * players stay in it from one game to the next.
 *
 * While a game is attached, its public projection is published on every change. Nothing a
 * phone sends changes the grimoire until the Storyteller approves it, and approving runs an
 * ordinary command, so it shows in History and can be rolled back.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { publicProjection, type PublicGameState } from '#lib/core/sync/public-projection.ts';
import {
	ROOM_PROTOCOL,
	type RoomMember,
	type RoomRequest,
	type ServerMessage
} from '#lib/core/sync/room.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { randomKey, readStored, RoomSocket, sha256Hex, writeStored } from './room-socket.svelte.ts';

const STORAGE_KEY = 'grim-games-room-host';

interface StoredRoom {
	code: string;
	key: string;
}

export class RoomHost {
	code = $state<string>();
	members = $state.raw<RoomMember[]>([]);
	requests = $state.raw<RoomRequest[]>([]);
	/** True when opening a room failed, e.g. offline. */
	problem = $state(false);
	#socket = $state.raw<RoomSocket>();
	#game: OpenGame | undefined;
	#stopWatching: (() => void) | undefined;
	#published: { gameId: string; state: PublicGameState } | undefined;
	#script: Script | undefined;

	constructor() {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (stored?.code && stored.key) this.#connect(stored);
	}

	get status() {
		return this.#socket?.status;
	}

	get refusedReason() {
		return this.#socket?.refusedReason;
	}

	/** Opens a new room for this device. */
	async open(): Promise<void> {
		this.problem = false;
		const key = randomKey();
		try {
			const response = await fetch('/api/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hostKeyHash: await sha256Hex(key) })
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const { code } = (await response.json()) as { code: string };
			const room = { code, key };
			writeStored(STORAGE_KEY, room);
			this.#connect(room);
		} catch {
			this.problem = true;
		}
	}

	/** Deletes the room for everyone in it. */
	close(): void {
		this.#socket?.send({ type: 'close' });
		this.#forget();
	}

	/**
	 * Publishes this game's public state, and its script, to the room while it is open on this
	 * device. Any open game will do, including one still in setup: phones get the script as
	 * soon as they join, before anyone has a seat.
	 */
	attach(game: OpenGame): void {
		if (this.#game === game) return;
		this.#stopWatching?.();
		this.#game = game;
		this.#stopWatching = $effect.root(() => {
			$effect(() => {
				const state = publicProjection(game.game);
				this.#publish({ gameId: game.game.gameId, state });
			});
			$effect(() => {
				const script = $state.snapshot(game.game.script) as Script;
				if (JSON.stringify(script) === JSON.stringify(this.#script)) return;
				this.#script = script;
				this.#socket?.send({ type: 'script', script });
			});
		});
	}

	/** Approves a request, optionally into a different seat, naming that seat in the grimoire. */
	approve(request: RoomRequest, seatId: SeatId | undefined = request.seatId): void {
		if (seatId && this.#game) {
			this.#game.run({ type: 'RenameSeat', seatId, playerName: request.name });
		}
		this.#socket?.send({ type: 'resolve', requestId: request.requestId, accept: true, seatId });
	}

	decline(request: RoomRequest): void {
		this.#socket?.send({ type: 'resolve', requestId: request.requestId, accept: false });
	}

	unseat(member: RoomMember): void {
		this.#socket?.send({ type: 'unseat', memberId: member.memberId });
	}

	#connect(room: StoredRoom): void {
		this.#socket?.stop();
		this.code = room.code;
		this.#socket = new RoomSocket(
			room.code,
			{ type: 'hello', role: 'host', key: room.key, protocol: ROOM_PROTOCOL },
			(m) => this.#receive(m),
			() => this.#resend()
		);
	}

	#receive(message: ServerMessage): void {
		if (message.type === 'host-view') {
			this.members = message.members;
			this.requests = message.requests;
		} else if (message.type === 'refused' && message.reason === 'too-old') {
			// The room is still this device's: keep it for after the update.
		} else if (message.type === 'refused' || message.type === 'closed') {
			// The room expired or this device no longer owns it.
			this.#forget();
		}
	}

	#publish(published: { gameId: string; state: PublicGameState }): void {
		this.#published = published;
		this.#resend();
	}

	#resend(): void {
		if (this.#published) this.#socket?.send({ type: 'publish', ...this.#published });
		if (this.#script) this.#socket?.send({ type: 'script', script: this.#script });
	}

	#forget(): void {
		this.#socket?.stop();
		this.#socket = undefined;
		this.code = undefined;
		this.members = [];
		this.requests = [];
		writeStored(STORAGE_KEY, undefined);
	}
}

let host: RoomHost | undefined;

/** This device's room, if it has opened one; created on first use. */
export function roomHost(): RoomHost {
	host ??= new RoomHost();
	return host;
}

/** Called wherever a game is open on the Storyteller's device, so phones follow it live. */
export function attachRoom(game: OpenGame): void {
	roomHost().attach(game);
}
