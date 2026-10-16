import { DurableObject } from 'cloudflare:workers';
import { normaliseRoomCode } from '../src/lib/core/sync/room-code.ts';
import { handleAccount, type Env as AccountRoutesEnv } from './account/routes.ts';
import { handleBotcScripts } from './botcscripts.ts';
import { handleShare, SharedScript, type ShareEnv } from './share.ts';

export { SharedScript };
export { AccountEmail, AccountUser } from './account/objects.ts';

export interface Env extends ShareEnv, AccountRoutesEnv {
	ASSETS: Fetcher;
	ROOMS: DurableObjectNamespace<Room>;
}

const MAX_NAMES = 30;
/**
 * A room is deleted after this long with no connections or messages. Durable Object storage
 * otherwise persists until deleted; the object itself hibernates after ~10 s idle and costs
 * nothing then (developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).
 */
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000;
const MAX_NAME_LENGTH = 40;

type ClientMessage = { type: 'add-name'; name: string };
type ServerMessage = { type: 'names'; names: string[] };

/**
 * One live game room. For now it only shares player names between devices, which is
 * enough to prove the deploy path; the public game projection replaces this in 0.98
 * (ROADMAP.md "Live multi-device").
 */
export class Room extends DurableObject<Env> {
	async names(): Promise<string[]> {
		return (await this.ctx.storage.get<string[]>('names')) ?? [];
	}

	/** Pushes the expiry back; called on every connection and message. */
	private async touch(): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
	}

	async alarm(): Promise<void> {
		for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'Room expired');
		await this.ctx.storage.deleteAll();
	}

	async fetch(request: Request): Promise<Response> {
		await this.touch();
		if (request.headers.get('Upgrade') !== 'websocket') {
			return Response.json({ names: await this.names() });
		}
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);
		server.send(
			JSON.stringify({ type: 'names', names: await this.names() } satisfies ServerMessage)
		);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(_ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		if (typeof raw !== 'string') return;
		let message: ClientMessage;
		try {
			message = JSON.parse(raw);
		} catch {
			return;
		}
		await this.touch();
		if (message?.type !== 'add-name' || typeof message.name !== 'string') return;
		const name = message.name.trim().slice(0, MAX_NAME_LENGTH);
		const names = await this.names();
		if (!name || names.includes(name) || names.length >= MAX_NAMES) return;
		names.push(name);
		await this.ctx.storage.put('names', names);
		const update = JSON.stringify({ type: 'names', names } satisfies ServerMessage);
		for (const socket of this.ctx.getWebSockets()) socket.send(update);
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/api/health') {
			return Response.json({ ok: true });
		}
		const room = url.pathname.match(/^\/api\/room\/([^/]+)$/);
		if (room) {
			const code = normaliseRoomCode(room[1]);
			if (!code) return new Response('Invalid room code', { status: 400 });
			return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
		}
		if (url.pathname.startsWith('/api/botcscripts/')) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleBotcScripts(url.pathname);
		}
		if (url.pathname === '/api/share' || url.pathname.startsWith('/api/share/')) {
			return handleShare(request, env);
		}
		const account = await handleAccount(request, env, url);
		if (account) return account;
		if (url.pathname.startsWith('/api/')) {
			return new Response('Not found', { status: 404 });
		}
		return env.ASSETS.fetch(request);
	}
} satisfies ExportedHandler<Env>;
