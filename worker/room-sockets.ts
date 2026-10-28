/** Sending to and closing a room's WebSockets, shared by the room and its transfers. */
import type { ServerMessage } from '../src/lib/core/sync/room.ts';

/**
 * Who is on a socket. `admin`: an admin watching from Live games (plan J31). It sees the public table, the script
 * and the grimoire when the room has it, sends nothing, and is in no list or count, so the
 * Storyteller and the phones never know it is there.
 */
export type Attachment =
	| { role: 'host' }
	| { role: 'player'; memberId: string }
	| { role: 'viewer' }
	| { role: 'town' }
	| { role: 'admin' }
	/** A device typing a transfer code (room-transfer.ts), by its new host key's hash. */
	| { role: 'claim'; keyHash: string };

export function send(ws: WebSocket, message: ServerMessage): void {
	sendText(ws, JSON.stringify(message));
}

/**
 * A socket that is closing is still listed by `getWebSockets()`, and sending to it throws,
 * which cut a broadcast short: the devices after it missed the update.
 */
export function sendText(ws: WebSocket, text: string): void {
	if (ws.readyState !== WebSocket.OPEN) return;
	try {
		ws.send(text);
	} catch {
		// It closed between the check and the send; its close handler tidies up.
	}
}

/** Closing a socket that has closed already throws too. */
export function closeSocket(ws: WebSocket, code: number, reason: string): void {
	try {
		ws.close(code, reason);
	} catch {
		// Already closed.
	}
}
