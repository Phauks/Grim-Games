import { DurableObject } from 'cloudflare:workers';
import { makeRoomCode, normaliseRoomCode } from '../src/lib/core/sync/room-code.ts';
import {
	cancelRequest,
	castVote,
	closeVote,
	gameOver,
	hostView,
	isScript,
	isSharedGrimoire,
	join,
	MAX_GRIMOIRE_BYTES,
	MAX_SCRIPT_BYTES,
	newRoom,
	openVote,
	parseClientMessage,
	playerView,
	publish,
	receiveFeedback,
	reopenGame,
	request,
	resolve,
	roomPreview,
	setViewers,
	supportsProtocol,
	unseat,
	type GrimoireView,
	type RoomState,
	type ScriptView,
	type ServerMessage
} from '../src/lib/core/sync/room.ts';

export interface RoomEnv {
	ROOMS: DurableObjectNamespace<Room>;
	ROOM_JOINS: RateLimit;
	ROOM_CREATES: RateLimit;
}

/**
 * A room is deleted after this long with no connections or messages. Durable Object storage
 * otherwise persists until deleted; the object itself hibernates after ~10 s idle and costs
 * nothing then (developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).
 */
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000;
/**
 * Public state is small (names and flags for at most a few dozen seats). Only the
 * Storyteller's device may send more, for a script with its own characters or the whole
 * grimoire for the view-only link.
 */
const MAX_MESSAGE_BYTES = 64 * 1024;
const KEY_PATTERN = /^[0-9a-f]{32,128}$/;

type Attachment = { role: 'host' } | { role: 'player'; memberId: string } | { role: 'viewer' };

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One live room (07-accounts-and-multi-device.md §4.2). The rules live in
 * `core/sync/room.ts`; this object stores the state, checks who is talking, and sends
 * each device its own view: the Storyteller sees members and requests, a player sees the
 * public table and their own place in it.
 */
export class Room extends DurableObject<RoomEnv> {
	private async load(): Promise<RoomState | undefined> {
		return this.ctx.storage.get<RoomState>('room');
	}

	/** Pushes the expiry back; called on every connection and message. */
	private async touch(): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
	}

	async alarm(): Promise<void> {
		this.broadcastClosed('Room expired');
		await this.ctx.storage.deleteAll();
	}

	/** Claims a fresh room for a Storyteller; false if the code is already in use. */
	async open(hostKeyHash: string): Promise<boolean> {
		if (await this.load()) return false;
		await this.ctx.storage.put('room', newRoom(hostKeyHash));
		await this.touch();
		return true;
	}

	async fetch(request: Request): Promise<Response> {
		const room = await this.load();
		if (request.headers.get('Upgrade') !== 'websocket') {
			const script = room && (await this.ctx.storage.get<ScriptView>('script'));
			return Response.json(roomPreview(room, script?.script));
		}
		if (room) await this.touch();
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const who = ws.deserializeAttachment() as Attachment | null;
		const limit = who?.role === 'host' ? MAX_GRIMOIRE_BYTES : MAX_MESSAGE_BYTES;
		if (typeof raw !== 'string' || raw.length > limit) return;
		const message = parseClientMessage(raw);
		if (!message) return;
		// Only the grimoire may be that large; a script keeps its own limit.
		if (raw.length > MAX_SCRIPT_BYTES && message.type !== 'grimoire') return;
		let room = await this.load();
		if (!room) {
			send(ws, { type: 'refused', reason: 'no-room' });
			ws.close(4404, 'No such room');
			return;
		}
		await this.touch();

		if (message.type === 'hello') {
			if (typeof message.key !== 'string' || !KEY_PATTERN.test(message.key)) return;
			if (!supportsProtocol(message.protocol)) {
				send(ws, { type: 'refused', reason: 'too-old' });
				ws.close(4426, 'Update the app');
				return;
			}
			const hash = await sha256(message.key);
			if (message.role === 'host') {
				if (hash !== room.hostKeyHash) {
					send(ws, { type: 'refused', reason: 'not-host' });
					ws.close(4403, 'Not the Storyteller');
					return;
				}
				ws.serializeAttachment({ role: 'host' } satisfies Attachment);
				send(ws, hostView(room));
				send(ws, { type: 'watchers', count: this.watchers() });
				return;
			}
			if (message.role === 'viewer') {
				if (hash !== room.viewerKeyHash) {
					send(ws, { type: 'refused', reason: 'not-viewer' });
					ws.close(4403, 'Link turned off');
					return;
				}
				ws.serializeAttachment({ role: 'viewer' } satisfies Attachment);
				const grimoire = await this.ctx.storage.get<GrimoireView>('grimoire');
				if (grimoire) send(ws, grimoire);
				this.tellWatchers();
				return;
			}
			const memberId = hash.slice(0, 24);
			const joined = join(room, memberId);
			if (!joined) {
				send(ws, { type: 'refused', reason: 'room-full' });
				ws.close(4429, 'Room full');
				return;
			}
			ws.serializeAttachment({ role: 'player', memberId } satisfies Attachment);
			if (joined !== room) await this.save(joined);
			else send(ws, playerView(room, memberId));
			const script = await this.ctx.storage.get<ScriptView>('script');
			if (script) send(ws, script);
			return;
		}
		if (!who || who.role === 'viewer') return;

		if (who.role === 'player') {
			const id = who.memberId;
			if (message.type === 'request') {
				room = request(room, id, message, Date.now(), crypto.randomUUID());
			} else if (message.type === 'cancel-request') {
				room = cancelRequest(room, id);
			} else if (message.type === 'leave-seat') {
				room = unseat(room, id);
			} else if (message.type === 'vote') {
				room = castVote(room, id, message.voteId, message.choice);
			} else if (message.type === 'feedback') {
				room = receiveFeedback(room, id, message.gameId, message.feedback, crypto.randomUUID());
			} else return;
			await this.save(room);
			return;
		}

		switch (message.type) {
			case 'publish':
				if (typeof message.gameId !== 'string' || !Array.isArray(message.state?.seats)) return;
				room = publish(room, message.gameId, message.state);
				break;
			case 'script': {
				// Kept apart from the room, so the table's frequent changes don't resend it.
				if (!isScript(message.script)) return;
				const view: ScriptView = { type: 'script', script: message.script };
				await this.ctx.storage.put('script', view);
				const text = JSON.stringify(view);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'player') socket.send(text);
				}
				return;
			}
			case 'viewers': {
				const next = setViewers(room, message.keyHash);
				if (next.viewerKeyHash === room.viewerKeyHash) return;
				// A link turned off (or replaced) stops working now, and its grimoire is deleted.
				await this.ctx.storage.delete('grimoire');
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role !== 'viewer') continue;
					send(socket, { type: 'refused', reason: 'not-viewer' });
					socket.close(4403, 'Link turned off');
				}
				this.tellWatchers();
				room = next;
				break;
			}
			case 'grimoire': {
				if (!room.viewerKeyHash || !isSharedGrimoire(message.grimoire)) return;
				const view: GrimoireView = { type: 'grimoire', grimoire: message.grimoire };
				await this.ctx.storage.put('grimoire', view);
				const text = JSON.stringify(view);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'viewer') socket.send(text);
				}
				return;
			}
			case 'resolve':
				room = resolve(
					room,
					message.requestId,
					message.accept === true,
					typeof message.seatId === 'string' ? message.seatId : undefined
				);
				break;
			case 'unseat':
				room = unseat(room, message.memberId);
				break;
			case 'open-vote':
				room = openVote(room, message.voteId, message.options, message.ability);
				break;
			case 'close-vote':
				room = closeVote(room);
				break;
			case 'game-over':
				room = gameOver(room, message.gameId, message.winner, message.reason);
				break;
			case 'reopen-game':
				room = reopenGame(room, message.gameId);
				break;
			case 'close':
				this.broadcastClosed('Room closed');
				await this.ctx.storage.deleteAll();
				return;
			default:
				return;
		}
		await this.save(room);
	}

	/** A viewer leaving changes the Storyteller's count of who is watching. */
	async webSocketClose(ws: WebSocket): Promise<void> {
		const who = ws.deserializeAttachment() as Attachment | null;
		if (who?.role === 'viewer') this.tellWatchers(ws);
	}

	/** Viewers still connected, leaving out one that is going. */
	private watchers(going?: WebSocket): number {
		let count = 0;
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'viewer' && socket !== going && socket.readyState === WebSocket.OPEN)
				count++;
		}
		return count;
	}

	/** Sends the Storyteller's device how many are watching. */
	private tellWatchers(going?: WebSocket): void {
		const text = JSON.stringify({ type: 'watchers', count: this.watchers(going) });
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'host') socket.send(text);
		}
	}

	/** Stores the room and sends every device its updated view. */
	private async save(room: RoomState): Promise<void> {
		await this.ctx.storage.put('room', room);
		const host = JSON.stringify(hostView(room));
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (!who || who.role === 'viewer') continue;
			socket.send(who.role === 'host' ? host : JSON.stringify(playerView(room, who.memberId)));
		}
	}

	private broadcastClosed(reason: string): void {
		for (const socket of this.ctx.getWebSockets()) {
			send(socket, { type: 'closed' });
			socket.close(1000, reason);
		}
	}
}

function send(ws: WebSocket, message: ServerMessage): void {
	ws.send(JSON.stringify(message));
}

const clientAddress = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'local';

/**
 * `POST /api/rooms` opens a room (body: the host key's hash) and returns its code;
 * `GET /api/room/<code>` says whether it is open and what game it holds (`RoomPreview`), or
 * upgrades to the room's WebSocket.
 * Returns undefined for other paths.
 */
export async function handleRoom(
	request: Request,
	env: RoomEnv,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname === '/api/rooms') {
		if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
		const limit = await env.ROOM_CREATES.limit({ key: clientAddress(request) });
		if (!limit.success) return new Response('Too many rooms', { status: 429 });
		const body = (await request.json().catch(() => null)) as { hostKeyHash?: unknown } | null;
		const hash = body?.hostKeyHash;
		if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
			return new Response('Bad request', { status: 400 });
		}
		// 10^6 codes and rooms last a day, so a free one is found within a few tries.
		for (let attempt = 0; attempt < 8; attempt++) {
			const code = makeRoomCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
			if (await env.ROOMS.get(env.ROOMS.idFromName(code)).open(hash)) {
				return Response.json({ code });
			}
		}
		return new Response('No free room code', { status: 503 });
	}
	const match = url.pathname.match(/^\/api\/room\/([^/]+)$/);
	if (!match) return undefined;
	const code = normaliseRoomCode(match[1]);
	if (!code) return new Response('Invalid room code', { status: 400 });
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
	// Limits guessing codes: a room shows only names and seats, but strangers shouldn't browse.
	const limit = await env.ROOM_JOINS.limit({ key: clientAddress(request) });
	if (!limit.success) return new Response('Too many tries', { status: 429 });
	return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
}
