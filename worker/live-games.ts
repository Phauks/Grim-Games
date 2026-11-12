import { noStore } from './http.ts';
import { DurableObject } from 'cloudflare:workers';
import {
	LIVE_GAMES_API,
	parseLiveGamePath,
	sortLiveGames,
	type LiveGame,
	type LiveGameList
} from '../src/lib/core/sync/live-games.ts';
import { GAME_HISTORY_API, parseSince } from '../src/lib/core/sync/game-ledger.ts';
import type { AccountEnv } from './account/objects.ts';
import { gameLedger } from './game-ledger.ts';
import { getUser } from './account/routes.ts';
import { isAdmin, type AdminsEnv } from './admins.ts';
import type { RoomEnv } from './room.ts';

export interface LiveGamesEnv extends RoomEnv, AccountEnv, AdminsEnv {
	LIVE_GAMES: DurableObjectNamespace<LiveGameIndex>;
}

/** Durable Objects can't be listed, so each room adds its code here when it opens. */
export function liveGameIndex(env: { LIVE_GAMES: DurableObjectNamespace<LiveGameIndex> }) {
	return env.LIVE_GAMES.get(env.LIVE_GAMES.idFromName('all'));
}

/**
 * The codes of the open rooms (plan J31), and nothing else: each room says what it holds when
 * an admin asks, so the list is never out of date and holds no game here.
 */
export class LiveGameIndex extends DurableObject {
	async add(code: string): Promise<void> {
		await this.ctx.storage.put(`room:${code}`, Date.now());
	}

	async remove(code: string): Promise<void> {
		await this.ctx.storage.delete(`room:${code}`);
	}

	/** Each open room's code and when it opened. */
	async rooms(): Promise<{ code: string; opened: number }[]> {
		const rooms = await this.ctx.storage.list<number>({ prefix: 'room:' });
		return [...rooms].map(([key, opened]) => ({ code: key.slice('room:'.length), opened }));
	}
}

/**
 * `GET /api/admin/games` lists the open rooms; `GET /api/admin/games/<code>` upgrades to a
 * read-only socket to one of them; `GET /api/admin/history?since=<ms>` is the games played in
 * rooms on every site (worker/game-ledger.ts). All answer 404 unless an admin account asks, so
 * the routes don't advertise themselves (as the reports inbox). Undefined for other paths.
 */
export async function handleLiveGames(
	request: Request,
	env: LiveGamesEnv,
	url: URL
): Promise<Response | undefined> {
	const history = url.pathname === GAME_HISTORY_API;
	if (!history && url.pathname !== LIVE_GAMES_API && !url.pathname.startsWith(`${LIVE_GAMES_API}/`))
		return undefined;
	const notFound = new Response('Not found', { status: 404, headers: noStore });
	if (request.method !== 'GET') return notFound;
	const auth = await getUser(request, env);
	if (!auth || !(await isAdmin(env, url, auth.user.email))) return notFound;

	if (history) {
		const ledger = gameLedger(env);
		const since = parseSince(url.searchParams.get('since'));
		const list = ledger ? await ledger.list(since) : { games: [], rooms: [] };
		return Response.json(list, { headers: noStore });
	}

	if (url.pathname === LIVE_GAMES_API) {
		const index = liveGameIndex(env);
		const games: LiveGame[] = [];
		await Promise.all(
			(await index.rooms()).map(async ({ code, opened }) => {
				const game = await env.ROOMS.get(env.ROOMS.idFromName(code)).liveGame(code, opened);
				// A room that has gone (closed or expired before it could say) leaves the list.
				if (game) games.push(game);
				else await index.remove(code);
			})
		);
		return Response.json({ games: sortLiveGames(games) } satisfies LiveGameList, {
			headers: noStore
		});
	}

	const code = parseLiveGamePath(url.pathname);
	if (!code || request.headers.get('Upgrade') !== 'websocket') return notFound;
	// The session cookie goes with any page's socket to us, so only our own pages may open one.
	if (request.headers.get('Origin') !== url.origin) return notFound;
	// The room sees this path and takes the socket as an admin's (Room.fetch); no other route
	// reaches a room with it.
	return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
}
