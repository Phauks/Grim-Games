/**
 * One device's connection to a live room, as the app makes it (features/room/room-socket.svelte.ts):
 * a WebSocket to `/api/room/<code>` whose first message is `hello` with the device's own key
 * (worker/room.ts). Node 22 has WebSocket built in.
 */
import { randomBytes } from 'node:crypto';
import { ROOM_PROTOCOL } from '#lib/core/sync/room-version.ts';
import type { ClientMessage, ServerMessage } from '#lib/core/sync/room-protocol.ts';

/** A device key like the app's (`randomKey`): 32 random bytes in hex. */
export const newKey = () => randomBytes(32).toString('hex');

/**
 * Joins and reconnects count against ROOM_JOINS, 60 a minute per address (wrangler.jsonc), and
 * every bot shares this machine's address, so they queue for a turn under that.
 */
export class JoinQueue {
	readonly #times: number[] = [];
	#chain = Promise.resolve();
	private readonly perMinute: number;
	private readonly gapMs: number;

	constructor(perMinute = 50, gapMs = 250) {
		this.perMinute = perMinute;
		this.gapMs = gapMs;
	}

	turn(): Promise<void> {
		const wait = this.#chain.then(async () => {
			for (;;) {
				const now = Date.now();
				while (this.#times.length && now - this.#times[0] > 60_000) this.#times.shift();
				const last = this.#times.at(-1) ?? 0;
				const ready =
					this.#times.length < this.perMinute ? last + this.gapMs : this.#times[0] + 60_000;
				if (now >= ready) break;
				await new Promise((r) => setTimeout(r, ready - now));
			}
			this.#times.push(Date.now());
		});
		this.#chain = wait;
		return wait;
	}
}

export type Role = 'host' | 'player';

export interface RoomSocketEvents {
	message(message: ServerMessage): void;
	/** The room closed the socket: `code` and `reason` are its (4404 no room, 4429 full, …). */
	closed(code: number, reason: string): void;
}

/** The room's WebSocket URL for a site such as https://beta.grimbinder.com. */
export function roomUrl(site: string, code: string): string {
	const url = new URL(`/api/room/${code}`, site);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	return url.toString();
}

export class RoomSocket {
	#ws: WebSocket | undefined;

	readonly #url: string;
	readonly #hello: ClientMessage;
	readonly #events: RoomSocketEvents;
	readonly #queue: JoinQueue;

	constructor(
		site: string,
		code: string,
		role: Role,
		key: string,
		events: RoomSocketEvents,
		queue: JoinQueue,
		hello: Partial<Extract<ClientMessage, { type: 'hello' }>> = {}
	) {
		this.#url = roomUrl(site, code);
		this.#hello = { type: 'hello', role, key, protocol: ROOM_PROTOCOL, ...hello };
		this.#events = events;
		this.#queue = queue;
	}

	get open(): boolean {
		return this.#ws?.readyState === WebSocket.OPEN;
	}

	async connect(): Promise<void> {
		await this.#queue.turn();
		const ws = new WebSocket(this.#url);
		this.#ws = ws;
		await new Promise<void>((resolve, reject) => {
			ws.addEventListener('open', () => resolve(), { once: true });
			ws.addEventListener('error', () => reject(new Error(`could not connect to ${this.#url}`)), {
				once: true
			});
		});
		ws.addEventListener('message', (event) => {
			if (typeof event.data !== 'string') return;
			let message: ServerMessage;
			try {
				message = JSON.parse(event.data) as ServerMessage;
			} catch {
				return; // Not JSON: nothing a phone would read.
			}
			this.#events.message(message);
		});
		ws.addEventListener('close', (event) => {
			// A drop of our own isn't news.
			if (this.#ws !== ws) return;
			this.#ws = undefined;
			this.#events.closed(event.code, event.reason);
		});
		this.send(this.#hello);
	}

	send(message: ClientMessage): boolean {
		if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return false;
		this.#ws.send(JSON.stringify(message));
		return true;
	}

	/** Drops the connection, as a phone does when its screen locks. */
	drop(): void {
		const ws = this.#ws;
		this.#ws = undefined;
		ws?.close(1000, 'bye');
	}
}
