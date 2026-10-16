/**
 * One WebSocket to a live room, kept open: it says hello with this device's key on every
 * (re)connect and retries with backoff when the phone sleeps or the Wi-Fi drops ("Code
 * updates disconnect all WebSockets", 07-accounts-and-multi-device.md §4).
 */
import type { ClientMessage, RefusedReason, ServerMessage } from '#lib/core/sync/room.ts';

export type RoomStatus = 'connecting' | 'open' | 'offline' | 'refused' | 'closed';

const MAX_BACKOFF_MS = 15_000;

export class RoomSocket {
	status = $state<RoomStatus>('connecting');
	/** Why the room turned this device away, when `status` is `refused`. */
	refusedReason = $state<RefusedReason>();
	readonly #url: string;
	readonly #hello: ClientMessage;
	readonly #onMessage: (message: ServerMessage) => void;
	readonly #onOpen: (() => void) | undefined;
	#ws: WebSocket | undefined;
	#retry: ReturnType<typeof setTimeout> | undefined;
	#attempt = 0;
	#stopped = false;

	/** `onOpen` runs after each hello, to resend what the room may have missed. */
	constructor(
		code: string,
		hello: ClientMessage,
		onMessage: (message: ServerMessage) => void,
		onOpen?: () => void
	) {
		this.#url = `${location.origin.replace(/^http/, 'ws')}/api/room/${code}`;
		this.#hello = hello;
		this.#onMessage = onMessage;
		this.#onOpen = onOpen;
		this.#connect();
		addEventListener('online', this.#reconnectNow);
		document.addEventListener('visibilitychange', this.#reconnectNow);
	}

	/** Sends now if connected; otherwise drops it (callers resend state on reconnect). */
	send(message: ClientMessage): boolean {
		if (this.#ws?.readyState !== WebSocket.OPEN) return false;
		this.#ws.send(JSON.stringify(message));
		return true;
	}

	stop(): void {
		this.#stopped = true;
		clearTimeout(this.#retry);
		removeEventListener('online', this.#reconnectNow);
		document.removeEventListener('visibilitychange', this.#reconnectNow);
		this.#ws?.close(1000);
	}

	#connect(): void {
		if (this.#stopped) return;
		const ws = new WebSocket(this.#url);
		this.#ws = ws;
		this.status = this.#attempt === 0 ? 'connecting' : 'offline';
		ws.onopen = () => {
			this.#attempt = 0;
			ws.send(JSON.stringify(this.#hello));
			this.#onOpen?.();
		};
		ws.onmessage = (event) => {
			let message: ServerMessage;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				return;
			}
			if (message.type === 'refused') {
				this.status = 'refused';
				this.refusedReason = message.reason;
				this.#stopped = true;
				// The room needs a newer build: look for it now, so the update prompt shows.
				if (message.reason === 'too-old') checkForUpdate();
			} else if (message.type === 'closed') {
				this.status = 'closed';
				this.#stopped = true;
			} else {
				this.status = 'open';
			}
			this.#onMessage(message);
		};
		ws.onclose = () => {
			if (this.#ws !== ws || this.#stopped) return;
			this.status = 'offline';
			const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.#attempt++);
			this.#retry = setTimeout(() => this.#connect(), delay);
		};
	}

	readonly #reconnectNow = () => {
		if (this.#stopped || document.visibilityState === 'hidden') return;
		if (this.#ws && this.#ws.readyState <= WebSocket.OPEN) return;
		clearTimeout(this.#retry);
		this.#attempt = 0;
		this.#connect();
	};
}

function checkForUpdate(): void {
	navigator.serviceWorker
		?.getRegistration()
		.then((registration) => registration?.update())
		.catch(() => {});
}

/** A random 32-byte key in hex: this device's secret for one room. */
export function randomKey(): string {
	return [...crypto.getRandomValues(new Uint8Array(32))]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** localStorage that never throws (private windows, blocked storage). */
export function readStored<T>(key: string): T | undefined {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : undefined;
	} catch {
		return undefined;
	}
}

export function writeStored(key: string, value: unknown): void {
	try {
		if (value === undefined) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Without storage the room still works until the page is closed.
	}
}
