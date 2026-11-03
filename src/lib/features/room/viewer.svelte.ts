/**
 * A viewer of the view-only grimoire link (Specters, Trevor 2026-10-18): it sees the
 * Storyteller's whole grimoire, live, and sends nothing back. The link's key comes from the
 * URL's hash, which never reaches the server, and is sent only in the socket's hello.
 */
import { normaliseGrimViewPassword } from '#lib/core/sync/grim-view-password.ts';
import { ROOM_PROTOCOL, type SharedGrimoire } from '#lib/core/sync/room.ts';
import { sha256Hex } from '#lib/core/codes/hash.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { playerName } from './player.svelte.ts';
import { RoomSocket } from './room-socket.svelte.ts';

const VIEWER_ID_KEY = 'grim-games-viewer-id';

/** This device's own id on Grim view, kept, so its messages read as one person's. */
function viewerId(): string {
	const kept = readStored<string>(VIEWER_ID_KEY);
	if (kept && /^[\w-]{8,64}$/.test(kept)) return kept;
	const made = crypto.randomUUID();
	writeStored(VIEWER_ID_KEY, made);
	return made;
}

/** The link's key, as the Storyteller's device makes it (`randomKey`). */
export function viewerKeyFrom(hash: string): string | undefined {
	const key = hash.replace(/^#/, '');
	return /^[0-9a-f]{64}$/.test(key) ? key : undefined;
}

/**
 * The view-only link's key made from a Grim view password (plan D1: "grim view by password
 * or direct link"), so a phone with the room code and the password opens the same grimoire
 * as the link. The code is part of it, so one password makes a different key in each room.
 * A made password matches however it was typed (`normaliseGrimViewPassword`).
 */
export function viewerKeyFromPassword(code: string, password: string): Promise<string> {
	return sha256Hex(`grim-games:grim-view:${code}:${normaliseGrimViewPassword(password)}`);
}

export class RoomViewer {
	/** The grimoire, once the Storyteller's device has sent it. */
	grimoire = $state.raw<SharedGrimoire>();
	/** The Storyteller takes messages from Grim view now (Trevor, 2026-11-03). */
	inbox = $state(false);
	readonly #socket: RoomSocket;

	constructor(code: string, key: string) {
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'viewer', key, protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'grimoire') this.grimoire = m.grimoire;
				else if (m.type === 'viewer-inbox') this.inbox = m.on;
				// As a phone hears it: whether it arrived, never what it said.
				else if (m.type === 'message-delivered')
					toast(t(m.delivered ? 'room.message.delivered' : 'room.message.notDelivered'));
			}
		);
	}

	get status() {
		return this.#socket.status;
	}

	get refusedReason() {
		return this.#socket.refusedReason;
	}

	/** A message to the Storyteller, under this device's Profile name. False when offline. */
	sendMessage(text: string, consult = false): boolean {
		const name = playerName.current.trim();
		return this.#socket.send({
			type: 'message',
			text,
			consult,
			from: viewerId(),
			...(name ? { name } : {})
		});
	}

	stop(): void {
		this.#socket.stop();
	}
}
